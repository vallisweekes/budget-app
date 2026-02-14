import { MONTHS } from "@/lib/constants/time";
import { getAllExpenses } from "@/lib/expenses/store";
import { getAllIncome } from "@/lib/income/store";
import { getPaymentsByMonth } from "@/lib/debts/store";
import { getAllSpending } from "@/lib/spending/store";
import { getMonthlyAllocationSnapshot } from "@/lib/allocations/store";
import type { MonthKey } from "@/types";

export interface ZeroBasedSummary {
	month: MonthKey;
	incomeTotal: number;
	expenseTotal: number;
	debtPaymentsTotal: number;
	spendingTotal: number;
	plannedAllowance: number;
	plannedSavings: number;
	plannedEmergency: number;
	plannedInvestments: number;
	unallocated: number;
}

export type BudgetMonthSummary = ZeroBasedSummary;

function sumAmounts(list: Array<{ amount: number }>): number {
	return list.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
}

export function isMonthKey(value: string): value is MonthKey {
	return (MONTHS as string[]).includes(value);
}

export async function getZeroBasedSummary(budgetPlanId: string, month: MonthKey): Promise<ZeroBasedSummary> {
	const [allocation, allIncome, allExpenses, allSpending, debtPayments] = await Promise.all([
		getMonthlyAllocationSnapshot(budgetPlanId, month),
		getAllIncome(budgetPlanId),
		getAllExpenses(budgetPlanId),
		getAllSpending(budgetPlanId),
		getPaymentsByMonth(budgetPlanId, month),
	]);

	const incomeTotal = sumAmounts(allIncome[month] ?? []);
	const expenseTotal = sumAmounts(allExpenses[month] ?? []);
	const debtPaymentsTotal = sumAmounts(debtPayments ?? []);
	const spendingTotal = sumAmounts((allSpending ?? []).filter((s) => s.month === month));

	const plannedAllowance = allocation.monthlyAllowance || 0;
	const plannedSavings = allocation.monthlySavingsContribution || 0;
	const plannedEmergency = allocation.monthlyEmergencyContribution || 0;
	const plannedInvestments = allocation.monthlyInvestmentContribution || 0;

	const unallocated =
		incomeTotal -
		expenseTotal -
		debtPaymentsTotal -
		plannedAllowance -
		plannedSavings -
		plannedEmergency -
		plannedInvestments;

	return {
		month,
		incomeTotal,
		expenseTotal,
		debtPaymentsTotal,
		spendingTotal,
		plannedAllowance,
		plannedSavings,
		plannedEmergency,
		plannedInvestments,
		unallocated,
	};
}

export async function getBudgetMonthSummary(budgetPlanId: string, month: MonthKey): Promise<BudgetMonthSummary> {
	return await getZeroBasedSummary(budgetPlanId, month);
}
