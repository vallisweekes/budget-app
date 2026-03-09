import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { supportsExpenseMovedToDebtField, supportsOnboardingPayFrequencyField } from "@/lib/prisma/capabilities";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { resolveEffectiveDueDateIso } from "@/lib/expenses/insights";
import { getPayPeriodAnchorFromWindow, normalizePayFrequency, resolveActivePayPeriodWindow, type PayFrequency } from "@/lib/payPeriods";
import { isLegacyPlaceholderExpenseRow } from "@/lib/expenses/legacyPlaceholders";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function toFloat(value: unknown): number {
	if (typeof value === "number") return value;
	const n = parseFloat(String(value ?? "0"));
	return Number.isNaN(n) ? 0 : n;
}

function parseIsoDate(iso: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
	const [year, month, day] = iso.split("-").map(Number);
	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
	return new Date(Date.UTC(year, month - 1, day));
}

function includeInMainExpenseSummary(expense: {
	isExtraLoggedExpense?: boolean | null;
	paymentSource?: string | null;
}): boolean {
	if (!Boolean(expense.isExtraLoggedExpense ?? false)) return true;
	return String(expense.paymentSource ?? "income").trim().toLowerCase() === "income";
}

function isUnknownMovedToDebtFieldError(error: unknown): boolean {
	const message = String((error as { message?: unknown })?.message ?? error);
	return (
		message.includes("isMovedToDebt") &&
		(message.includes("Unknown arg") || message.includes("Unknown argument") || message.includes("Unknown field"))
	);
}

function isUnknownPayFrequencyFieldError(error: unknown): boolean {
	const message = String((error as { message?: unknown })?.message ?? error);
	return (
		message.includes("payFrequency") &&
		(message.includes("Unknown arg") || message.includes("Unknown argument") || message.includes("Unknown field"))
	);
}

async function findOnboardingPayFrequency(userId: string) {
	if (!(await supportsOnboardingPayFrequencyField())) return null;

	try {
		return await prisma.userOnboardingProfile.findUnique({
			where: { userId },
			select: { payFrequency: true },
		});
	} catch (error) {
		if (!isUnknownPayFrequencyFieldError(error)) throw error;
		return null;
	}
}

type ExpenseRow = {
	id: string;
	name: string;
	amount: unknown;
	isAllocation?: boolean | null;
	isExtraLoggedExpense?: boolean | null;
	paymentSource?: string | null;
	seriesKey?: string | null;
	dueDate: Date | null;
	month: number;
	year: number;
	periodKey?: string | null;
};

/**
 * GET /api/bff/expenses/months?budgetPlanId=<optional>
 *
 * Returns pay-period-anchored month buckets that contain expenses for a plan.
 * This keeps sparse/additional plans aligned with the same pay-period logic used
 * by the summary and dashboard flows instead of exposing raw stored expense months.
 */
export async function GET(req: NextRequest) {
	try {
		const userId = await getSessionUserId(req);
		if (!userId) return unauthorized();

		const { searchParams } = new URL(req.url);
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

		const rows = await (async () => {
			const runLegacyQuery = () =>
				prisma.expense.findMany({
					where: { budgetPlanId },
					orderBy: { createdAt: "asc" },
				});

			if (!(await supportsExpenseMovedToDebtField())) {
				return runLegacyQuery();
			}

			try {
				return await prisma.expense.findMany({
					where: {
						budgetPlanId,
						isMovedToDebt: false,
					},
					orderBy: { createdAt: "asc" },
				});
			} catch (error) {
				if (!isUnknownMovedToDebtFieldError(error)) throw error;
				return runLegacyQuery();
			}
		})();

		const buckets = new Map<string, Map<string, { exp: ExpenseRow; rank: number }>>();

		for (const exp of rows as ExpenseRow[]) {
			if (isLegacyPlaceholderExpenseRow(exp)) continue;

			let anchorMonth = exp.month;
			let anchorYear = exp.year;
			let dedupeScope = "";
			let rank = 0;

			if (exp.dueDate) {
				const dueIso = resolveEffectiveDueDateIso(
					{
						id: exp.id,
						name: exp.name,
						amount: toFloat(exp.amount),
						paid: false,
						paidAmount: 0,
						dueDate: exp.dueDate.toISOString().slice(0, 10),
					},
					{ year: exp.year, monthNum: exp.month, payDate },
				);
				if (!dueIso) continue;
				const due = parseIsoDate(dueIso);
				if (!due) continue;

				const window = resolveActivePayPeriodWindow({
					now: due,
					payDate,
					payFrequency,
				});
				const anchor = getPayPeriodAnchorFromWindow({ window, payFrequency });
				anchorMonth = anchor.anchorMonth;
				anchorYear = anchor.anchorYear;
				dedupeScope = dueIso;
				const dueYear = Number(dueIso.slice(0, 4));
				const dueMonth = Number(dueIso.slice(5, 7));
				rank = exp.year === dueYear && exp.month === dueMonth ? 0 : 1;
			} else if (exp.periodKey) {
				const start = parseIsoDate(exp.periodKey);
				if (!start) continue;
				const window = resolveActivePayPeriodWindow({
					now: start,
					payDate,
					payFrequency,
				});
				const anchor = getPayPeriodAnchorFromWindow({ window, payFrequency });
				anchorMonth = anchor.anchorMonth;
				anchorYear = anchor.anchorYear;
				dedupeScope = `unscheduled:${exp.periodKey}`;
			} else {
				dedupeScope = `unscheduled:${exp.year}-${exp.month}`;
			}

			const bucketKey = `${anchorYear}-${anchorMonth}`;
			const series = String(exp.seriesKey ?? exp.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
			const amount = toFloat(exp.amount);
			const itemKey = `${series}|${dedupeScope}|${amount}`;

			if (!buckets.has(bucketKey)) {
				buckets.set(bucketKey, new Map());
			}

			const bucket = buckets.get(bucketKey)!;
			const existing = bucket.get(itemKey);
			if (!existing || rank < existing.rank) {
				bucket.set(itemKey, { exp, rank });
			}
		}

		const months = Array.from(buckets.entries())
			.map(([bucketKey, bucket]) => {
				const [yearText, monthText] = bucketKey.split("-");
				const mainExpenses = Array.from(bucket.values())
					.map((entry) => entry.exp)
					.filter(includeInMainExpenseSummary);

				return {
					year: Number(yearText),
					month: Number(monthText),
					totalCount: mainExpenses.length,
					totalAmount: parseFloat(mainExpenses.reduce((sum, exp) => sum + toFloat(exp.amount), 0).toFixed(2)),
				};
			})
			.filter((item) => item.totalCount > 0 || item.totalAmount > 0)
			.sort((left, right) => (left.year - right.year) || (left.month - right.month));

		return NextResponse.json({ months });
	} catch (error) {
		console.error("Failed to compute expense months:", error);
		const detail =
			process.env.NODE_ENV !== "production"
				? error instanceof Error
					? error.message
					: String(error)
				: undefined;
		return NextResponse.json(
			{ error: "Failed to compute expense months", ...(detail ? { detail } : {}) },
			{ status: 500 },
		);
	}
}
