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

	const [budgetPlan, onboardingProfile] = await Promise.all([
		prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true },
		}),
		findOnboardingPayFrequency(userId),
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

	let expenses: Array<{
		id: string;
		name: string;
		amount: unknown;
		paid: boolean;
		paidAmount: unknown;
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
		periodStart = selected.start;
		periodEnd = selected.end;

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

		expenses = periodRows.filter((exp) => {
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
			if (!dueIso || !periodStart || !periodEnd) return false;
			const due = parseIsoDate(dueIso);
			if (!due) return false;
			return inRange(due, periodStart, periodEnd);
		});
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

	// ── Server-side aggregations ──────────────────────────────────────────────

	let totalAmount = 0;
	let paidAmount = 0;
	let unpaidAmount = 0;
	let paidCount = 0;
	let unpaidCount = 0;

	const catMap = new Map<
		string,
		{
			categoryId: string;
			name: string;
			color: string | null;
			icon: string | null;
			total: number;
			paidTotal: number;
			paidCount: number;
			totalCount: number;
		}
	>();

	for (const exp of expenses) {
		const amount = toFloat(exp.amount);
		const paid = toFloat(exp.paidAmount);
		const unpaid = Math.max(0, amount - paid);

		totalAmount += amount;
		paidAmount += paid;
		unpaidAmount += unpaid;
		if (exp.paid) paidCount++;
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
		if (exp.paid) cat.paidCount += 1;
	}

	const categoryBreakdown = Array.from(catMap.values()).sort(
		(a, b) => b.total - a.total,
	);

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
		totalCount: expenses.length,
		totalAmount: parseFloat(totalAmount.toFixed(2)),
		paidCount,
		paidAmount: parseFloat(paidAmount.toFixed(2)),
		unpaidCount,
		unpaidAmount: parseFloat(unpaidAmount.toFixed(2)),
		categoryBreakdown,
	});
}
