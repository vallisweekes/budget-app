import { resolveEffectiveDueDateIso } from "@/lib/expenses/insights";
import { isLegacyPlaceholderExpenseRow } from "@/lib/expenses/legacyPlaceholders";
import { getEffectiveDirectDebitByExpenseId } from "@/lib/expenses/directDebit";
import { resolveMatchedExpensePeriodKey } from "@/lib/helpers/periodKey";
import { supportsExpenseMovedToDebtField } from "@/lib/prisma/capabilities";
import { prisma } from "@/lib/prisma";
import type { PayFrequency } from "@/lib/payPeriods";

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
	return !Boolean(expense.isExtraLoggedExpense ?? false);
}

export async function getPayPeriodExpenses(params: {
	budgetPlanId: string;
	windowStart: Date;
	windowEnd: Date;
	payDate: number;
	payFrequency?: PayFrequency;
	includeLoggedExpensesInResults?: boolean;
}): Promise<PayPeriodExpenseRow[]> {
	const {
		budgetPlanId,
		windowStart,
		windowEnd,
		payDate,
		payFrequency = "monthly",
		includeLoggedExpensesInResults = false,
	} = params;
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
	const effectiveDirectDebitByExpenseId = await getEffectiveDirectDebitByExpenseId({
		budgetPlanId,
		expenses: (rows as PayPeriodExpenseRow[]).map((expense) => ({
			id: expense.id,
			name: expense.name,
			seriesKey: expense.seriesKey,
			categoryId: expense.categoryId,
			isDirectDebit: expense.isDirectDebit,
		})),
	});

	const seen = new Map<string, { expense: PayPeriodExpenseRow; rank: number }>();
	for (const expense of rows as PayPeriodExpenseRow[]) {
		const effectiveDirectDebit = effectiveDirectDebitByExpenseId.get(expense.id);
		const normalizedExpense =
			effectiveDirectDebit === undefined || effectiveDirectDebit === Boolean(expense.isDirectDebit ?? false)
				? expense
				: { ...expense, isDirectDebit: effectiveDirectDebit };

		if (isLegacyPlaceholderExpenseRow(normalizedExpense)) continue;
		if (Boolean(normalizedExpense.isAllocation ?? false)) continue;
		if (!includeLoggedExpensesInResults && !includeInPlannedExpenseTotals(normalizedExpense)) continue;

		const series = normalizeSeriesOrName(normalizedExpense.seriesKey, normalizedExpense.name);
		const amount = Number(normalizedExpense.amount ?? 0);

		if (normalizedExpense.dueDate) {
			const dueIso = resolveEffectiveDueDateIso(
				{
					id: normalizedExpense.id,
					name: normalizedExpense.name,
					amount,
					paid: Boolean(normalizedExpense.paid),
					paidAmount: Number(normalizedExpense.paidAmount ?? 0),
					dueDate: new Date(normalizedExpense.dueDate).toISOString().slice(0, 10),
				},
				{ year: normalizedExpense.year, monthNum: normalizedExpense.month, payDate }
			);
			if (!dueIso) continue;
			const due = new Date(`${dueIso}T00:00:00.000Z`);
			if (!Number.isFinite(due.getTime()) || !inRangeUtc(due, windowStart, windowEnd)) continue;

			const dueMonth = due.getUTCMonth() + 1;
			const dueYear = due.getUTCFullYear();
			const rank = normalizedExpense.year === dueYear && normalizedExpense.month === dueMonth ? 0 : 1;
			const key = `${series}|${dueIso}|${amount}`;
			const existing = seen.get(key);
			if (!existing || rank < existing.rank) {
				seen.set(key, { expense: normalizedExpense, rank });
			}
			continue;
		}

		const expensePeriodKey = String(normalizedExpense.periodKey ?? "").trim();
		const isLoggedExpense = Boolean(normalizedExpense.isExtraLoggedExpense ?? false);
		let dedupeScope = "";
		if (expensePeriodKey) {
			const matchedPeriodKey = resolveMatchedExpensePeriodKey({
				storedPeriodKey: expensePeriodKey,
				selectedPeriodStart: windowStart,
				anchorYear: windowStart.getUTCFullYear(),
				anchorMonth: windowStart.getUTCMonth() + 1,
				payFrequency,
			});
			if (matchedPeriodKey) {
				dedupeScope = `unscheduled:${matchedPeriodKey}`;
			} else {
				// Some logged rows were saved with local-date periodKey offsets.
				// Keep them period-visible by falling back to start/end month matching.
				if (!isLoggedExpense || !allowedUnscheduledYm.has(`${normalizedExpense.year}-${normalizedExpense.month}`)) continue;
				dedupeScope = `unscheduled:${normalizedExpense.year}-${normalizedExpense.month}`;
			}
		} else {
			if (!allowedUnscheduledYm.has(`${normalizedExpense.year}-${normalizedExpense.month}`)) continue;
			dedupeScope = `unscheduled:${normalizedExpense.year}-${normalizedExpense.month}`;
		}

		const key = `${series}|${dedupeScope}|${amount}`;
		if (!seen.has(key)) {
			seen.set(key, { expense: normalizedExpense, rank: 0 });
		}
	}

	return Array.from(seen.values()).map((entry) => entry.expense);
}