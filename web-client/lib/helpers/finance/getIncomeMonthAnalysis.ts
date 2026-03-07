import { getAllIncome, getIncomeForAnchorMonth } from "@/lib/income/store";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getMonthlyDebtPlan } from "@/lib/helpers/finance/getMonthlyDebtPlan";
import { resolveEffectiveDueDateIso } from "@/lib/expenses/insights";
import { isLegacyPlaceholderExpenseRow } from "@/lib/expenses/legacyPlaceholders";
import { buildPayPeriodFromMonthAnchor, normalizePayFrequency, type PayFrequency } from "@/lib/payPeriods";
import { supportsExpenseMovedToDebtField } from "@/lib/prisma/capabilities";
import { prisma } from "@/lib/prisma";
import { getPeriodKey } from "@/lib/helpers/periodKey";
import type { MonthKey } from "@/types";

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "string") return Number(value);
	if (typeof value === "object") {
		const maybeDecimal = value as { toNumber?: () => number; toString?: () => string };
		if (typeof maybeDecimal.toNumber === "function") return maybeDecimal.toNumber();
		if (typeof maybeDecimal.toString === "function") return Number(maybeDecimal.toString());
	}
	return Number(value);
}

type Params = {
	budgetPlanId: string;
	year: number;
	month: number;
	payFrequency?: PayFrequency | null | undefined;
};

function normalizeIncomeKey(name: unknown): string {
	return String(name ?? "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

function daysInMonthUtc(year: number, monthIndex0: number): number {
	return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function clampDayUtc(year: number, monthIndex0: number, day: number): Date {
	const maxDay = daysInMonthUtc(year, monthIndex0);
	const clamped = Math.max(1, Math.min(maxDay, Math.floor(day)));
	return new Date(Date.UTC(year, monthIndex0, clamped));
}

function utcDateOnly(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function resolveEffectiveExpenseDueDateUtc(expense: { dueDate: Date | null; year: number; month: number }, payDate: number): Date | null {
	if (expense.dueDate) return utcDateOnly(expense.dueDate);
	if (!Number.isFinite(expense.year) || !Number.isFinite(expense.month)) return null;
	if (expense.month < 1 || expense.month > 12) return null;
	const safePayDate = Number.isFinite(payDate) ? Math.max(1, Math.floor(payDate)) : 27;
	return clampDayUtc(expense.year, expense.month - 1, safePayDate);
}

function inRangeUtc(target: Date, start: Date, end: Date): boolean {
	const time = target.getTime();
	return time >= start.getTime() && time <= end.getTime();
}

function normalizeSeriesOrName(seriesKey: unknown, name: unknown): string {
	const raw = String(seriesKey ?? name ?? "").trim().toLowerCase();
	return raw.replace(/\s+/g, " ");
}

async function getPeriodExpenseSnapshot(params: {
	budgetPlanId: string;
	windowStart: Date;
	windowEnd: Date;
	payDate: number;
}): Promise<{ plannedExpenses: number; paidExpenses: number; expenseIds: string[] }> {
	const { budgetPlanId, windowStart, windowEnd, payDate } = params;
	const periodPairs = [
		{ year: windowStart.getUTCFullYear(), month: windowStart.getUTCMonth() + 1 },
		{ year: windowEnd.getUTCFullYear(), month: windowEnd.getUTCMonth() + 1 },
	];
	const uniquePairs = Array.from(new Map(periodPairs.map((pair) => [`${pair.year}-${pair.month}`, pair])).values());
	const expenseWhere = {
		budgetPlanId,
		OR: [
			...uniquePairs,
			{ dueDate: { gte: windowStart, lte: windowEnd } },
		],
	};

	const baseSelect = {
		id: true,
		name: true,
		seriesKey: true,
		amount: true,
		paidAmount: true,
		paid: true,
		dueDate: true,
		year: true,
		month: true,
		isAllocation: true,
		isDirectDebit: true,
	} as const;

	const rows = await (async () => {
		if (!(await supportsExpenseMovedToDebtField())) {
			return prisma.expense.findMany({
				where: expenseWhere,
				select: baseSelect,
				orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
			});
		}

		return prisma.expense.findMany({
			where: { ...expenseWhere, isMovedToDebt: false },
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

	const seen = new Map<string, { expense: (typeof rows)[number]; rank: number }>();
	for (const expense of rows as any[]) {
		if (isLegacyPlaceholderExpenseRow(expense)) continue;
		if (Boolean(expense.isAllocation ?? false)) continue;

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
					dueDate: expense.dueDate ? new Date(expense.dueDate).toISOString().slice(0, 10) : undefined,
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

		if (!allowedUnscheduledYm.has(`${expense.year}-${expense.month}`)) continue;
		const key = `${series}|unscheduled:${expense.year}-${expense.month}|${amount}`;
		if (!seen.has(key)) {
			seen.set(key, { expense, rank: 0 });
		}
	}

	const selectedExpenses = Array.from(seen.values()).map((entry) => entry.expense);
	return {
		plannedExpenses: selectedExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0),
		paidExpenses: selectedExpenses.reduce((sum, expense) => sum + Number(expense.paidAmount ?? 0), 0),
		expenseIds: selectedExpenses.map((expense) => String(expense.id ?? "").trim()).filter(Boolean),
	};
}

export async function getIncomeMonthAnalysis({ budgetPlanId, year, month, payFrequency }: Params) {
	const monthKey = monthNumberToKey(month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12) as MonthKey;
	const prevMonth = month === 1 ? 12 : month - 1;
	const prevYear = month === 1 ? year - 1 : year;
	const cadence = normalizePayFrequency(payFrequency);

	// Fetch payDate first so we can compute the pay-period window for period-based queries.
	const plan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true, kind: true, eventDate: true },
	});
	const payDate = Number(plan?.payDate ?? 27);
	const eventScope = (() => {
		const kind = String(plan?.kind ?? "");
		const eventDate = plan?.eventDate instanceof Date ? plan.eventDate : null;
		if (!eventDate) return null;
		if (kind !== "holiday" && kind !== "carnival") return null;
		return {
			kind,
			eventYear: eventDate.getFullYear(),
			eventMonth: eventDate.getMonth() + 1,
		};
	})();
	const periodWindow = cadence === "monthly"
		? buildPayPeriodFromMonthAnchor({ anchorYear: year, anchorMonth: month, payDate, payFrequency: cadence })
		: null;
	const periodKey = periodWindow ? getPeriodKey(periodWindow.start, payDate) : undefined;
	const expenseSnapshotPromise = cadence === "monthly" && periodWindow
		? getPeriodExpenseSnapshot({
			budgetPlanId,
			windowStart: periodWindow.start,
			windowEnd: periodWindow.end,
			payDate,
		})
		: Promise.resolve(null);

	const [incomeByMonth, periodIncomeItems, allocationSnapshot, customAllocationsSnapshot, debtPlan, expenseSnapshot] = await Promise.all([
		cadence === "monthly" ? Promise.resolve(null) : getAllIncome(budgetPlanId, year),
		cadence === "monthly"
			? getIncomeForAnchorMonth({ budgetPlanId, year, month, payDate, payFrequency: cadence, scope: eventScope })
			: Promise.resolve(null),
		getMonthlyAllocationSnapshot(budgetPlanId, monthKey, { year }),
		getMonthlyCustomAllocationsSnapshot(budgetPlanId, monthKey, { year }),
		getMonthlyDebtPlan({ budgetPlanId, year, month, periodKey, periodStart: periodWindow?.start }),
		expenseSnapshotPromise,
	]);

	const incomeItems = cadence === "monthly"
		? (periodIncomeItems ?? [])
		: ((incomeByMonth?.[monthKey] ?? []));
	const grossIncome = incomeItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);

	let plannedExpenses = 0;
	let paidExpenses = 0;
	let periodPaidDebtFromIncome: number | null = null;
	if (cadence === "monthly") {
		plannedExpenses = expenseSnapshot?.plannedExpenses ?? 0;

		// Paid expenses: get ALL income-sourced payments for this period's expenses,
		// regardless of when the payment was made. If the user paid a bill early
		// (before payday), it should still reduce "income remaining".
		const periodExpenseIds = expenseSnapshot?.expenseIds ?? [];

		if (periodExpenseIds.length > 0) {
			const paidAgg = await prisma.expensePayment.aggregate({
				where: {
					expenseId: { in: periodExpenseIds },
					source: "income",
				},
				_sum: { amount: true },
			});
			paidExpenses = decimalToNumber(paidAgg._sum.amount);
		}

		// Debt payments from income are already period-scoped via getMonthlyDebtPlan.
		periodPaidDebtFromIncome = debtPlan.paidDebtPaymentsFromIncome;
	} else {
		const expenseAgg = await prisma.expense.aggregate({
			where: { budgetPlanId, year, month, isAllocation: false, isMovedToDebt: false },
			_sum: { amount: true, paidAmount: true },
		});
		plannedExpenses = decimalToNumber(expenseAgg._sum.amount);
		paidExpenses = decimalToNumber(expenseAgg._sum.paidAmount);
	}

	const monthlyAllowance = Number(allocationSnapshot.monthlyAllowance ?? 0);
	const savingsContribution = Number(allocationSnapshot.monthlySavingsContribution ?? 0);
	const emergencyContribution = Number(allocationSnapshot.monthlyEmergencyContribution ?? 0);
	const investmentContribution = Number(allocationSnapshot.monthlyInvestmentContribution ?? 0);
	const plannedSetAsideFromAllocations = savingsContribution + emergencyContribution + investmentContribution;
	const customSetAsideTotal = Number(customAllocationsSnapshot.total ?? 0);
	const plannedSetAside = plannedSetAsideFromAllocations + customSetAsideTotal + monthlyAllowance;

	const plannedDebtPayments = debtPlan.plannedDebtPayments;
	// Use period-based debt payment total when available (monthly cadence);
	// otherwise fall back to the calendar year/month from getMonthlyDebtPlan.
	const paidDebtPaymentsFromIncome = periodPaidDebtFromIncome ?? debtPlan.paidDebtPaymentsFromIncome;

	const plannedBills = plannedExpenses + plannedDebtPayments;
	const paidBillsSoFar = paidExpenses + paidDebtPaymentsFromIncome;
	const remainingBills = Math.max(0, plannedBills - paidBillsSoFar);
	const moneyLeftAfterPlan = grossIncome - plannedBills - plannedSetAside;
	const incomeLeftRightNow = grossIncome - paidBillsSoFar - plannedSetAside;
	const moneyOutTotal = plannedBills + plannedSetAside;

	return {
		month,
		year,
		monthKey,
		incomeItems,
		grossIncome,
		sourceCount: incomeItems.length,
		plannedExpenses,
		paidExpenses,
		plannedDebtPayments,
		paidDebtPaymentsFromIncome,
		monthlyAllowance,
		incomeSacrifice: plannedSetAside,
		setAsideBreakdown: {
			savings: savingsContribution,
			emergency: emergencyContribution,
			investments: investmentContribution,
			custom: customSetAsideTotal,
			fromAllocations: plannedSetAsideFromAllocations,
			customCount: customAllocationsSnapshot.items?.length ?? 0,
			isAllowanceOverride: !!allocationSnapshot.isOverride,
		},
		plannedBills,
		paidBillsSoFar,
		remainingBills,
		moneyLeftAfterPlan,
		incomeLeftRightNow,
		moneyOutTotal,
		isOnPlan: moneyLeftAfterPlan >= 0,
	};
}
