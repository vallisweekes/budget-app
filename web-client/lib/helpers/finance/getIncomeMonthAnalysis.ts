import { getAllIncome, getIncomeForAnchorMonth } from "@/lib/income/store";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getMonthlyDebtPlan } from "@/lib/helpers/finance/getMonthlyDebtPlan";
import { buildPayPeriodFromMonthAnchor, normalizePayFrequency, type PayFrequency } from "@/lib/payPeriods";
import { prisma } from "@/lib/prisma";
import { getPeriodKey } from "@/lib/helpers/periodKey";
import { getPayPeriodExpenses, includeInPlannedExpenseTotals } from "@/lib/helpers/finance/payPeriodExpenses";
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

async function getPeriodExpenseSnapshot(params: {
	budgetPlanId: string;
	windowStart: Date;
	windowEnd: Date;
	payDate: number;
}): Promise<{ plannedExpenses: number; paidExpenses: number; expenseIds: string[] }> {
	const selectedExpenses = await getPayPeriodExpenses(params);
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
		getMonthlyDebtPlan({
			budgetPlanId,
			year,
			month,
			periodKey,
			periodStart: periodWindow?.start,
			periodEnd: periodWindow?.end,
		}),
		expenseSnapshotPromise,
	]);

	const incomeItems = cadence === "monthly"
		? (periodIncomeItems ?? [])
		: ((incomeByMonth?.[monthKey] ?? []));
	const grossIncome = incomeItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);

	let plannedExpenses = 0;
	let paidExpenses = 0;
	let paidExpensesFromIncome = 0;
	let periodPaidDebtFromIncome: number | null = null;
	let periodPaidDebtAllSources: number | null = null;
	if (cadence === "monthly") {
		plannedExpenses = expenseSnapshot?.plannedExpenses ?? 0;
		paidExpenses = expenseSnapshot?.paidExpenses ?? 0;

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
			paidExpensesFromIncome = decimalToNumber(paidAgg._sum.amount);
		}

		// Debt payment totals are already period-scoped via getMonthlyDebtPlan.
		periodPaidDebtAllSources = debtPlan.totalPaidDebtPayments;
		periodPaidDebtFromIncome = debtPlan.paidDebtPaymentsFromIncome;
	} else {
		const expenseRows = await prisma.expense.findMany({
			where: { budgetPlanId, year, month, isAllocation: false, isMovedToDebt: false },
			select: {
				amount: true,
				paidAmount: true,
				isExtraLoggedExpense: true,
				paymentSource: true,
			},
		});
		const includedExpenseRows = expenseRows.filter((expense) => includeInPlannedExpenseTotals(expense));
		plannedExpenses = includedExpenseRows.reduce((sum, expense) => sum + decimalToNumber(expense.amount), 0);
		paidExpenses = includedExpenseRows.reduce((sum, expense) => sum + decimalToNumber(expense.paidAmount), 0);
		paidExpensesFromIncome = paidExpenses;
	}

	const monthlyAllowance = Number(allocationSnapshot.monthlyAllowance ?? 0);
	const savingsContribution = Number(allocationSnapshot.monthlySavingsContribution ?? 0);
	const emergencyContribution = Number(allocationSnapshot.monthlyEmergencyContribution ?? 0);
	const investmentContribution = Number(allocationSnapshot.monthlyInvestmentContribution ?? 0);
	const plannedSetAsideFromAllocations = savingsContribution + emergencyContribution + investmentContribution;
	const customSetAsideTotal = Number(customAllocationsSnapshot.total ?? 0);
	const plannedSetAside = plannedSetAsideFromAllocations + customSetAsideTotal + monthlyAllowance;

	const plannedDebtPayments = debtPlan.plannedDebtPayments;
	const totalPaidDebtPayments = periodPaidDebtAllSources ?? debtPlan.totalPaidDebtPayments;
	// Use period-based debt payment total when available (monthly cadence);
	// otherwise fall back to the calendar year/month from getMonthlyDebtPlan.
	const paidDebtPaymentsFromIncome = periodPaidDebtFromIncome ?? debtPlan.paidDebtPaymentsFromIncome;

	const plannedBills = plannedExpenses + plannedDebtPayments;
	const paidBillsSoFar = paidExpenses + totalPaidDebtPayments;
	const remainingExpenseBills = Math.max(0, plannedExpenses - paidExpenses);
	const remainingDebtBills = Math.max(0, plannedDebtPayments - totalPaidDebtPayments);
	const remainingBills = remainingExpenseBills + remainingDebtBills;
	const moneyLeftAfterPlan = grossIncome - plannedBills - plannedSetAside;
	const spendableIncomeRightNow = grossIncome - paidExpensesFromIncome - paidDebtPaymentsFromIncome - plannedSetAside;
	const leftToPayRightNow = remainingBills;
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
		remainingExpenseBills,
		remainingDebtBills,
		remainingBills,
		moneyLeftAfterPlan,
		incomeLeftRightNow: spendableIncomeRightNow,
		spendableIncomeRightNow,
		leftToPayRightNow,
		moneyOutTotal,
		isOnPlan: moneyLeftAfterPlan >= 0,
	};
}
