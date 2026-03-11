import { resolveEffectiveDueDateIso } from "@/lib/expenses/insights";
import { isLegacyPlaceholderExpenseRow } from "@/lib/expenses/legacyPlaceholders";
import { getPeriodKey } from "@/lib/helpers/periodKey";
import { supportsExpenseMovedToDebtField } from "@/lib/prisma/capabilities";
import { prisma } from "@/lib/prisma";

export type PayPeriodExpenseRow = {
	id: string;
	name: string;
	seriesKey: string | null;
	merchantDomain: string | null;
	logoUrl: string | null;
	logoSource: string | null;
	amount: unknown;
	paid: boolean;
	paidAmount: unknown;
	categoryId: string | null;
	isAllocation?: boolean | null;
	isDirectDebit?: boolean | null;
	isExtraLoggedExpense?: boolean | null;
	paymentSource?: string | null;
	periodKey?: string | null;
	dueDate: Date | null;
	year: number;
	month: number;
	isMovedToDebt?: boolean | null;
};

function normalizeSeriesOrName(seriesKey: unknown, name: unknown): string {
	const raw = String(seriesKey ?? name ?? "").trim().toLowerCase();
	return raw.replace(/\s+/g, " ");
}

function inRangeUtc(target: Date, start: Date, end: Date): boolean {
	const time = target.getTime();
	return time >= start.getTime() && time <= end.getTime();
}

export function includeInPlannedExpenseTotals(expense: {
	isExtraLoggedExpense?: boolean | null;
	paymentSource?: string | null;
}): boolean {
	if (!Boolean(expense.isExtraLoggedExpense ?? false)) return true;
	return String(expense.paymentSource ?? "income").trim().toLowerCase() === "income";
}

export async function getPayPeriodExpenses(params: {
	budgetPlanId: string;
	windowStart: Date;
	windowEnd: Date;
	payDate: number;
}): Promise<PayPeriodExpenseRow[]> {
	const { budgetPlanId, windowStart, windowEnd, payDate } = params;
	const periodPairs = [
		{ year: windowStart.getUTCFullYear(), month: windowStart.getUTCMonth() + 1 },
		{ year: windowEnd.getUTCFullYear(), month: windowEnd.getUTCMonth() + 1 },
		{
			year: new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() - 1, 1)).getUTCFullYear(),
			month: new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() - 1, 1)).getUTCMonth() + 1,
		},
		{
			year: new Date(Date.UTC(windowEnd.getUTCFullYear(), windowEnd.getUTCMonth() + 1, 1)).getUTCFullYear(),
			month: new Date(Date.UTC(windowEnd.getUTCFullYear(), windowEnd.getUTCMonth() + 1, 1)).getUTCMonth() + 1,
		},
	];
	const uniquePairs = Array.from(new Map(periodPairs.map((pair) => [`${pair.year}-${pair.month}`, pair])).values());
	const currentPeriodKey = getPeriodKey(windowStart, payDate);
	const baseSelect = {
		id: true,
		name: true,
		seriesKey: true,
		merchantDomain: true,
		logoUrl: true,
		logoSource: true,
		amount: true,
		paid: true,
		paidAmount: true,
		categoryId: true,
		isAllocation: true,
		isDirectDebit: true,
		isExtraLoggedExpense: true,
		paymentSource: true,
		periodKey: true,
		dueDate: true,
		year: true,
		month: true,
	} as const;

	const rows = await (async () => {
		if (!(await supportsExpenseMovedToDebtField())) {
			return prisma.expense.findMany({
				where: { budgetPlanId, OR: uniquePairs },
				select: baseSelect,
				orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
			});
		}

		return prisma.expense.findMany({
			where: { budgetPlanId, OR: uniquePairs, isMovedToDebt: false },
			select: {
				...baseSelect,
				isMovedToDebt: true,
			},
			orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
		});
	})();

	const allowedUnscheduledYm = new Set([
		`${windowStart.getUTCFullYear()}-${windowStart.getUTCMonth() + 1}`,
		`${windowEnd.getUTCFullYear()}-${windowEnd.getUTCMonth() + 1}`,
	]);

	const seen = new Map<string, { expense: PayPeriodExpenseRow; rank: number }>();
	for (const expense of rows as PayPeriodExpenseRow[]) {
		if (isLegacyPlaceholderExpenseRow(expense)) continue;
		if (Boolean(expense.isAllocation ?? false)) continue;
		if (!includeInPlannedExpenseTotals(expense)) continue;

		const series = normalizeSeriesOrName(expense.seriesKey, expense.name);
		const amount = Number(expense.amount ?? 0);

		if (expense.dueDate) {
			const dueIso = resolveEffectiveDueDateIso(
				{
					id: expense.id,
					name: expense.name,
					amount,
					paid: Boolean(expense.paid),
					paidAmount: Number(expense.paidAmount ?? 0),
					dueDate: new Date(expense.dueDate).toISOString().slice(0, 10),
				},
				{ year: expense.year, monthNum: expense.month, payDate }
			);
			if (!dueIso) continue;
			const due = new Date(`${dueIso}T00:00:00.000Z`);
			if (!Number.isFinite(due.getTime()) || !inRangeUtc(due, windowStart, windowEnd)) continue;

			const dueMonth = due.getUTCMonth() + 1;
			const dueYear = due.getUTCFullYear();
			const rank = expense.year === dueYear && expense.month === dueMonth ? 0 : 1;
			const key = `${series}|${dueIso}|${amount}`;
			const existing = seen.get(key);
			if (!existing || rank < existing.rank) {
				seen.set(key, { expense, rank });
			}
			continue;
		}

		const expensePeriodKey = String(expense.periodKey ?? "").trim();
		let dedupeScope = "";
		if (expensePeriodKey) {
			if (expensePeriodKey !== currentPeriodKey) continue;
			dedupeScope = `unscheduled:${expensePeriodKey}`;
		} else {
			if (!allowedUnscheduledYm.has(`${expense.year}-${expense.month}`)) continue;
			dedupeScope = `unscheduled:${expense.year}-${expense.month}`;
		}

		const key = `${series}|${dedupeScope}|${amount}`;
		if (!seen.has(key)) {
			seen.set(key, { expense, rank: 0 });
		}
	}

	return Array.from(seen.values()).map((entry) => entry.expense);
}