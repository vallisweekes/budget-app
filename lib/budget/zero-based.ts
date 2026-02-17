import { MONTHS } from "@/lib/constants/time";
import { getAllExpenses } from "@/lib/expenses/store";
import { getAllIncome } from "@/lib/income/store";
import { getPaymentsByMonth } from "@/lib/debts/store";
import { getAllSpending } from "@/lib/spending/store";
import { getMonthlyAllocationSnapshot } from "@/lib/allocations/store";
import { prisma } from "@/lib/prisma";
import type { MonthKey } from "@/types";

export interface ZeroBasedSummary {
	month: MonthKey;
	year: number;
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

async function resolveSummaryYear(budgetPlanId: string): Promise<number> {
	const latestIncome = await prisma.income.findFirst({
		where: { budgetPlanId },
		orderBy: [{ year: "desc" }, { month: "desc" }],
		select: { year: true },
	});
	if (latestIncome?.year) return latestIncome.year;

	const latestExpense = await prisma.expense.findFirst({
		where: { budgetPlanId },
		orderBy: [{ year: "desc" }, { month: "desc" }],
		select: { year: true },
	});
	return latestExpense?.year ?? new Date().getFullYear();
}

export async function getZeroBasedSummary(
	budgetPlanId: string,
	month: MonthKey,
	options?: { year?: number }
): Promise<ZeroBasedSummary> {
	const year = options?.year ?? (await resolveSummaryYear(budgetPlanId));

	const [allocation, allIncome, allExpenses, allSpending, debtPayments] = await Promise.all([
		getMonthlyAllocationSnapshot(budgetPlanId, month, { year }),
		getAllIncome(budgetPlanId, year),
		getAllExpenses(budgetPlanId, year),
		getAllSpending(budgetPlanId),
		getPaymentsByMonth(budgetPlanId, month, year),
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
		year,
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
