import { getAllIncome } from "@/lib/income/store";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getMonthlyDebtPlan } from "@/lib/helpers/finance/getMonthlyDebtPlan";
import { prisma } from "@/lib/prisma";
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
};

export async function getIncomeMonthAnalysis({ budgetPlanId, year, month }: Params) {
	const monthKey = monthNumberToKey(month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12) as MonthKey;

	const [incomeByMonth, expenseAgg, allocationSnapshot, customAllocationsSnapshot, debtPlan] = await Promise.all([
		getAllIncome(budgetPlanId, year),
		prisma.expense.aggregate({
			where: { budgetPlanId, year, month },
			_sum: { amount: true, paidAmount: true },
		}),
		getMonthlyAllocationSnapshot(budgetPlanId, monthKey, { year }),
		getMonthlyCustomAllocationsSnapshot(budgetPlanId, monthKey, { year }),
		getMonthlyDebtPlan({ budgetPlanId, year, month }),
	]);

	const incomeItems = incomeByMonth[monthKey] ?? [];
	const grossIncome = incomeItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);

	const plannedExpenses = decimalToNumber(expenseAgg._sum.amount);
	const paidExpenses = decimalToNumber(expenseAgg._sum.paidAmount);

	const monthlyAllowance = Number(allocationSnapshot.monthlyAllowance ?? 0);
	const savingsContribution = Number(allocationSnapshot.monthlySavingsContribution ?? 0);
	const emergencyContribution = Number(allocationSnapshot.monthlyEmergencyContribution ?? 0);
	const investmentContribution = Number(allocationSnapshot.monthlyInvestmentContribution ?? 0);
	const plannedSetAsideFromAllocations = savingsContribution + emergencyContribution + investmentContribution;
	const customSetAsideTotal = Number(customAllocationsSnapshot.total ?? 0);
	const plannedSetAside = plannedSetAsideFromAllocations + customSetAsideTotal + monthlyAllowance;

	const plannedDebtPayments = debtPlan.plannedDebtPayments;
	const paidDebtPaymentsFromIncome = debtPlan.paidDebtPaymentsFromIncome;

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
