import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { supportsExpenseMovedToDebtField, supportsOnboardingPayFrequencyField } from "@/lib/prisma/capabilities";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { resolveEffectiveDueDateIso } from "@/lib/expenses/insights";
import {
	buildPayPeriodFromMonthAnchor,
	normalizePayFrequency,
	type PayFrequency,
} from "@/lib/payPeriods";
import { isLegacyPlaceholderExpenseRow } from "@/lib/expenses/legacyPlaceholders";
import { getExpensePaidMap } from "@/lib/expenses/paidSummary";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(msg: string) {
	return NextResponse.json({ error: msg }, { status: 400 });
}

function toN(v: string | null): number | null {
	if (v == null) return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function toFloat(value: unknown): number {
	if (typeof value === "number") return value;
	const n = parseFloat(String(value ?? "0"));
	return isNaN(n) ? 0 : n;
}

function includeInMainExpenseSummary(expense: {
	isExtraLoggedExpense?: boolean | null;
	paymentSource?: string | null;
}): boolean {
	// Keep summary in sync with CategoryExpensesScreen:
	// - income-sourced logged payments behave like normal expenses
	// - non-income logged payments live in the separate "Logged payments" bucket
	if (!Boolean(expense.isExtraLoggedExpense ?? false)) return true;
	return String(expense.paymentSource ?? "income").trim().toLowerCase() === "income";
}

type CategoryBreakdownRow = {
	categoryId: string;
	name: string;
	color: string | null;
	icon: string | null;
	total: number;
	paidTotal: number;
	paidCount: number;
	totalCount: number;
};

function latestDate(...dates: Array<Date | null | undefined>): Date | null {
	const valid = dates.filter((d): d is Date => d instanceof Date);
	if (valid.length === 0) return null;
	return valid.reduce((acc, curr) => (curr.getTime() > acc.getTime() ? curr : acc));
}

function normalizeCategoryBreakdown(raw: unknown): CategoryBreakdownRow[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((row) => {
			if (typeof row !== "object" || row === null) return null;
			const candidate = row as Record<string, unknown>;
			return {
				categoryId: String(candidate.categoryId ?? "__none__"),
				name: String(candidate.name ?? "Uncategorised"),
				color: candidate.color == null ? null : String(candidate.color),
				icon: candidate.icon == null ? null : String(candidate.icon),
				total: toFloat(candidate.total),
				paidTotal: toFloat(candidate.paidTotal),
				paidCount: Math.max(0, Math.floor(toFloat(candidate.paidCount))),
				totalCount: Math.max(0, Math.floor(toFloat(candidate.totalCount))),
			};
		})
		.filter((row): row is CategoryBreakdownRow => row !== null);
}

function getExpenseSummarySnapshotDelegate() {
	const client = prisma as unknown as {
		expenseSummarySnapshot?: {
			findUnique: (...args: unknown[]) => Promise<unknown>;
			upsert: (...args: unknown[]) => Promise<unknown>;
		};
	};
	return client.expenseSummarySnapshot;
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function toIsoDate(d: Date): string {
	return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseIsoDate(iso: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
	const [y, m, d] = iso.split("-").map(Number);
	if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
	return new Date(Date.UTC(y, m - 1, d));
}

function inRange(target: Date, start: Date, end: Date): boolean {
	return target.getTime() >= start.getTime() && target.getTime() <= end.getTime();
}

function isUnknownMovedToDebtFieldError(error: unknown): boolean {
	const message = String((error as { message?: unknown })?.message ?? error);
	return (
		message.includes("isMovedToDebt") &&
		(message.includes("Unknown arg") ||
			message.includes("Unknown argument") ||
			message.includes("Unknown field"))
	);
}

function isUnknownPayFrequencyFieldError(error: unknown): boolean {
	const message = String((error as { message?: unknown })?.message ?? error);
	return (
		message.includes("payFrequency") &&
		(message.includes("Unknown arg") ||
			message.includes("Unknown argument") ||
			message.includes("Unknown field"))
	);
}

async function findOnboardingPayFrequency(userId: string) {
	if (!(await supportsOnboardingPayFrequencyField())) return null;

	try {
		const profile = await prisma.userOnboardingProfile.findUnique({
			where: { userId },
			select: { payFrequency: true },
		});
		return profile;
	} catch (error) {
		if (!isUnknownPayFrequencyFieldError(error)) throw error;
		return null;
	}
}

/**
 * GET /api/bff/expenses/summary?month=N&year=N&budgetPlanId=<optional>
 *
 * Server-computes the full monthly expense summary so both web and mobile
 * share identical calculation logic — no client-side arithmetic needed.
 *
 * Returns:
 *   totalCount        — total number of expenses
 *   totalAmount       — sum of all expense amounts
 *   paidCount         — number of paid expenses
 *   paidAmount        — sum of paid expense amounts (uses paidAmount field)
 *   unpaidCount       — number of unpaid expenses
 *   unpaidAmount      — sum of unpaid/remaining amounts
 *   categoryBreakdown — per-category totals (sorted by total desc)
 *   month, year       — echoed back for convenience
 */
export async function GET(req: NextRequest) {
	const userId = await getSessionUserId(req);
	if (!userId) return unauthorized();

	const { searchParams } = new URL(req.url);
	const month = toN(searchParams.get("month"));
	const year = toN(searchParams.get("year"));
	const scope = String(searchParams.get("scope") ?? "month").toLowerCase() === "pay_period" ? "pay_period" : "month";

	if (month == null || month < 1 || month > 12) return badRequest("Invalid month");
	if (year == null || year < 1900) return badRequest("Invalid year");

	const budgetPlanId = await resolveOwnedBudgetPlanId({
		userId,
		budgetPlanId: searchParams.get("budgetPlanId"),
	});
	if (!budgetPlanId) {
		return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
	}

	const [budgetPlan, onboardingProfile, planCategories] = await Promise.all([
		prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true },
		}),
		findOnboardingPayFrequency(userId),
		prisma.category.findMany({
			where: { budgetPlanId },
			select: { id: true, name: true, color: true, icon: true },
		}),
	]);
	const payDate = Number.isFinite(Number(budgetPlan?.payDate)) && Number(budgetPlan?.payDate) >= 1
		? Math.floor(Number(budgetPlan?.payDate))
		: 1;
	const payFrequency: PayFrequency = normalizePayFrequency(onboardingProfile?.payFrequency);

	let periodStart: Date | null = null;
	let periodEnd: Date | null = null;
	let periodLabel: string | null = null;
	let periodRangeLabel: string | null = null;
	let periodIndex: number | null = null;
	let periodKey: string | null = null;
	let sourceWindowPairs: Array<{ year: number; month: number }> = [{ year, month }];
	const allowedUnscheduledYm = new Set<string>();

	let expenses: Array<{
		id: string;
		name: string;
		amount: unknown;
		paid: boolean;
		paidAmount: unknown;
		isAllocation?: boolean | null;
		seriesKey?: string | null;
		periodKey?: string | null;
		isExtraLoggedExpense?: boolean | null;
		paymentSource?: string | null;
		dueDate: Date | null;
		year: number;
		month: number;
		categoryId: string | null;
		category: { id: string; name: string; color: string | null; icon: string | null } | null;
	}> = [];

	if (scope === "pay_period") {
		const selected = buildPayPeriodFromMonthAnchor({
			anchorYear: year,
			anchorMonth: month,
			payDate,
			payFrequency,
		});
		allowedUnscheduledYm.add(`${selected.start.getUTCFullYear()}-${selected.start.getUTCMonth() + 1}`);
		allowedUnscheduledYm.add(`${selected.end.getUTCFullYear()}-${selected.end.getUTCMonth() + 1}`);
		periodStart = selected.start;
		periodEnd = selected.end;
		periodKey = toIsoDate(selected.start);

		periodIndex = Math.max(1, Math.min(12, month) - 1);
		periodLabel = `Pay period ${periodIndex}`;
		periodRangeLabel = `${selected.start.getUTCDate()} ${selected.start.toLocaleString("en-GB", {
			month: "short",
			timeZone: "UTC",
		})} - ${selected.end.getUTCDate()} ${selected.end.toLocaleString("en-GB", {
			month: "short",
			timeZone: "UTC",
		})}`;

		const windowPairs = [
			{ year: selected.start.getUTCFullYear(), month: selected.start.getUTCMonth() + 1 },
			{ year: selected.end.getUTCFullYear(), month: selected.end.getUTCMonth() + 1 },
			{
				year: new Date(Date.UTC(selected.start.getUTCFullYear(), selected.start.getUTCMonth() - 1, 1)).getUTCFullYear(),
				month: new Date(Date.UTC(selected.start.getUTCFullYear(), selected.start.getUTCMonth() - 1, 1)).getUTCMonth() + 1,
			},
			{
				year: new Date(Date.UTC(selected.end.getUTCFullYear(), selected.end.getUTCMonth() + 1, 1)).getUTCFullYear(),
				month: new Date(Date.UTC(selected.end.getUTCFullYear(), selected.end.getUTCMonth() + 1, 1)).getUTCMonth() + 1,
			},
		];
		const uniquePairs = Array.from(new Map(windowPairs.map((p) => [`${p.year}-${p.month}`, p])).values());
		sourceWindowPairs = uniquePairs;
	}

	const snapshotDelegate = getExpenseSummarySnapshotDelegate();

	const snapshot = snapshotDelegate
		? await snapshotDelegate.findUnique({
				where: {
					budgetPlanId_scope_month_year: {
						budgetPlanId,
						scope,
						month,
						year,
					},
				},
		  }) as {
				periodLabel: string | null;
				periodIndex: number | null;
				periodStart: Date | null;
				periodEnd: Date | null;
				periodRangeLabel: string | null;
				payDate: number;
				payFrequency: string;
				totalCount: number;
				totalAmount: unknown;
				paidCount: number;
				paidAmount: unknown;
				unpaidCount: number;
				unpaidAmount: unknown;
				categoryBreakdown: unknown;
				sourceMaxUpdatedAt: Date | null;
			} | null
		: null;

	const sourceWhere =
		scope === "month"
			? { budgetPlanId, month, year }
			: { budgetPlanId, OR: sourceWindowPairs };

	const sourceRows = await prisma.expense.findMany({
		where: sourceWhere,
		select: { id: true, updatedAt: true },
	});

	const expenseMaxUpdatedAt = latestDate(...sourceRows.map((row) => row.updatedAt));
	const sourceExpenseIds = sourceRows.map((row) => row.id);

	let paymentMaxUpdatedAt: Date | null = null;
	if (sourceExpenseIds.length > 0) {
		const paymentAggregate = await prisma.expensePayment.aggregate({
			where: { expenseId: { in: sourceExpenseIds } },
			_max: { updatedAt: true },
		});
		paymentMaxUpdatedAt = paymentAggregate._max.updatedAt ?? null;
	}

	const sourceMaxUpdatedAt = latestDate(expenseMaxUpdatedAt, paymentMaxUpdatedAt);

	const snapshotIsFresh =
		snapshot != null &&
		((snapshot.sourceMaxUpdatedAt == null && sourceMaxUpdatedAt == null) ||
			(snapshot.sourceMaxUpdatedAt != null &&
				sourceMaxUpdatedAt != null &&
				snapshot.sourceMaxUpdatedAt.getTime() >= sourceMaxUpdatedAt.getTime()));

	if (snapshotIsFresh && snapshot) {
		return NextResponse.json({
			scope,
			month,
			year,
			periodLabel: snapshot.periodLabel,
			periodIndex: snapshot.periodIndex,
			periodStart: snapshot.periodStart ? toIsoDate(snapshot.periodStart) : null,
			periodEnd: snapshot.periodEnd ? toIsoDate(snapshot.periodEnd) : null,
			periodRangeLabel: snapshot.periodRangeLabel,
			payDate: snapshot.payDate,
			payFrequency: snapshot.payFrequency,
			totalCount: snapshot.totalCount,
			totalAmount: parseFloat(toFloat(snapshot.totalAmount).toFixed(2)),
			paidCount: snapshot.paidCount,
			paidAmount: parseFloat(toFloat(snapshot.paidAmount).toFixed(2)),
			unpaidCount: snapshot.unpaidCount,
			unpaidAmount: parseFloat(toFloat(snapshot.unpaidAmount).toFixed(2)),
			categoryBreakdown: normalizeCategoryBreakdown(snapshot.categoryBreakdown),
		});
	}

	if (scope === "pay_period") {
		const uniquePairs = sourceWindowPairs;

		const periodRows = await (async () => {
			const runLegacyQuery = () =>
				prisma.expense.findMany({
					where: {
						budgetPlanId,
						OR: uniquePairs,
					},
					include: {
						category: { select: { id: true, name: true, color: true, icon: true } },
					},
					orderBy: { createdAt: "asc" },
				});

			if (!(await supportsExpenseMovedToDebtField())) {
				return runLegacyQuery();
			}

			try {
				const rows = await prisma.expense.findMany({
					where: {
						budgetPlanId,
						OR: uniquePairs,
						isMovedToDebt: false,
					},
					include: {
						category: { select: { id: true, name: true, color: true, icon: true } },
					},
					orderBy: { createdAt: "asc" },
				});
				return rows;
			} catch (error) {
				if (!isUnknownMovedToDebtFieldError(error)) throw error;
				return runLegacyQuery();
			}
		})();

		const seen = new Map<string, { exp: (typeof periodRows)[number]; rank: number }>();
		for (const exp of periodRows) {
			if (isLegacyPlaceholderExpenseRow(exp)) continue;
			// Allocations/envelopes are not bills and should not impact expense totals.
			if (Boolean(exp.isAllocation ?? false)) continue;

			let dedupeScope = "";
			let rank = 1;
			if (exp.dueDate) {
				const dueIso = resolveEffectiveDueDateIso(
					{
						id: exp.id,
						name: exp.name,
						amount: toFloat(exp.amount),
						paid: exp.paid,
						paidAmount: toFloat(exp.paidAmount),
						dueDate: exp.dueDate ? exp.dueDate.toISOString().slice(0, 10) : undefined,
					},
					{ year: exp.year, monthNum: exp.month, payDate }
				);
				if (!dueIso || !periodStart || !periodEnd) continue;
				const due = parseIsoDate(dueIso);
				if (!due) continue;
				if (!inRange(due, periodStart, periodEnd)) continue;
				dedupeScope = dueIso;
				const ym = /^\d{4}-\d{2}-\d{2}$/.test(dueIso)
					? { year: Number(dueIso.slice(0, 4)), month: Number(dueIso.slice(5, 7)) }
					: null;
				rank = ym && Number.isFinite(ym.year) && Number.isFinite(ym.month) && exp.year === ym.year && exp.month === ym.month ? 0 : 1;
			} else {
				// Prefer the persisted pay-period assignment for unscheduled/logged expenses.
				// Fall back to month/year only for legacy rows that do not have a periodKey.
				if (exp.periodKey) {
					if (!periodKey || exp.periodKey !== periodKey) continue;
					dedupeScope = `unscheduled:${exp.periodKey}`;
				} else {
					if (!allowedUnscheduledYm.has(`${exp.year}-${exp.month}`)) continue;
					dedupeScope = `unscheduled:${exp.year}-${exp.month}`;
				}
				rank = 0;
			}

			const series = String(exp.seriesKey ?? exp.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
			const amount = toFloat(exp.amount);
			const key = `${series}|${dedupeScope}|${amount}`;

			const existing = seen.get(key);
			if (!existing) {
				seen.set(key, { exp, rank });
				continue;
			}
			if (rank < existing.rank) {
				seen.set(key, { exp, rank });
			}
		}

		expenses = Array.from(seen.values()).map((v) => v.exp);
	} else {
		expenses = await prisma.expense.findMany({
			where: { budgetPlanId, month, year },
			include: {
				category: {
					select: { id: true, name: true, color: true, icon: true },
				},
			},
			orderBy: { createdAt: "asc" },
		});
	}

	// Allocations/envelopes are not bills and should not impact expense totals.
	expenses = expenses.filter((e) => !Boolean(e.isAllocation ?? false));

	// In pay-period views, only treat explicitly scheduled items as bills.
	// Note: pay-period scope includes both scheduled and unscheduled expenses.

	// ── Server-side aggregations (from expensePayment transaction records) ────

	// Resolve actual paid amounts from the expensePayment table — the single
	// source of truth.  The scalar `expense.paid` / `expense.paidAmount` fields
	// are a denormalized cache that can drift and must NOT be used here.
	const paidMap = await getExpensePaidMap(
		expenses.map((e) => ({ id: e.id, amount: toFloat(e.amount) })),
	);

	let totalAmount = 0;
	let paidAmount = 0;
	let unpaidAmount = 0;
	let paidCount = 0;
	let unpaidCount = 0;

	const catMap = new Map<string, CategoryBreakdownRow>();

	for (const category of planCategories) {
		catMap.set(category.id, {
			categoryId: category.id,
			name: category.name,
			color: category.color ?? null,
			icon: category.icon ?? null,
			total: 0,
			paidTotal: 0,
			paidCount: 0,
			totalCount: 0,
		});
	}

	const mainExpenses = expenses.filter(includeInMainExpenseSummary);

	for (const exp of mainExpenses) {
		const amount = toFloat(exp.amount);
		const info = paidMap.get(exp.id);
		const paidRaw = info?.paidAmount ?? 0;
		// For planning/progress UI, cap paid-attributed-to-plan at the planned amount.
		// Raw payments can exceed planned (overpayment/duplicate logs), but should not
		// inflate "paid" totals beyond what was actually due for the period.
		const paid = amount > 0 ? Math.min(paidRaw, amount) : 0;
		const isPaid = info?.isPaid ?? false;
		const unpaid = Math.max(0, amount - paid);

		totalAmount += amount;
		paidAmount += paid;
		unpaidAmount += unpaid;
		if (isPaid) paidCount++;
		else unpaidCount++;

		// Category grouping
		const catId = exp.categoryId ?? "__none__";
		const catName = exp.category?.name ?? "Uncategorised";
		const catColor = exp.category?.color ?? null;
		const catIcon = exp.category?.icon ?? null;

		let cat = catMap.get(catId);
		if (!cat) {
			cat = {
				categoryId: catId,
				name: catName,
				color: catColor,
				icon: catIcon,
				total: 0,
				paidTotal: 0,
				paidCount: 0,
				totalCount: 0,
			};
			catMap.set(catId, cat);
		}
		cat.total += amount;
		cat.paidTotal += paid;
		cat.totalCount += 1;
		if (isPaid) cat.paidCount += 1;
	}

	const categoryBreakdown = Array.from(catMap.values())
		.filter((c) => c.totalCount > 0)
		.sort((a, b) => b.total - a.total);

	if (snapshotDelegate) {
		await snapshotDelegate.upsert({
			where: {
				budgetPlanId_scope_month_year: {
					budgetPlanId,
					scope,
					month,
					year,
				},
			},
			create: {
				budgetPlanId,
				scope,
				month,
				year,
				payDate,
				payFrequency,
				periodKey,
				periodLabel,
				periodIndex,
				periodStart,
				periodEnd,
				periodRangeLabel,
				totalCount: mainExpenses.length,
				totalAmount: parseFloat(totalAmount.toFixed(2)),
				paidCount,
				paidAmount: parseFloat(paidAmount.toFixed(2)),
				unpaidCount,
				unpaidAmount: parseFloat(unpaidAmount.toFixed(2)),
				categoryBreakdown,
				sourceMaxUpdatedAt,
			},
			update: {
				payDate,
				payFrequency,
				periodKey,
				periodLabel,
				periodIndex,
				periodStart,
				periodEnd,
				periodRangeLabel,
				totalCount: mainExpenses.length,
				totalAmount: parseFloat(totalAmount.toFixed(2)),
				paidCount,
				paidAmount: parseFloat(paidAmount.toFixed(2)),
				unpaidCount,
				unpaidAmount: parseFloat(unpaidAmount.toFixed(2)),
				categoryBreakdown,
				sourceMaxUpdatedAt,
			},
		});
	}

	return NextResponse.json({
		scope,
		month,
		year,
		periodLabel,
		periodIndex,
		periodStart: periodStart ? toIsoDate(periodStart) : null,
		periodEnd: periodEnd ? toIsoDate(periodEnd) : null,
		periodRangeLabel,
		payDate,
		payFrequency,
		totalCount: mainExpenses.length,
		totalAmount: parseFloat(totalAmount.toFixed(2)),
		paidCount,
		paidAmount: parseFloat(paidAmount.toFixed(2)),
		unpaidCount,
		unpaidAmount: parseFloat(unpaidAmount.toFixed(2)),
		categoryBreakdown,
	});
}
