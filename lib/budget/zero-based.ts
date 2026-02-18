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

function prismaBudgetPlanHasField(fieldName: string): boolean {
	try {
		const fields = (prisma as any)?._runtimeDataModel?.models?.BudgetPlan?.fields;
		if (!Array.isArray(fields)) return false;
		return fields.some((f: any) => f?.name === fieldName);
	} catch {
		return false;
	}
}

async function resolveSummaryYear(budgetPlanId: string): Promise<number> {
	// Holiday/Carnival plans should default to the event year.
	if (prismaBudgetPlanHasField("eventDate")) {
		const plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: { kind: true, eventDate: true } as any,
		});
		const kind = String((plan as any)?.kind ?? "");
		const eventDate = (plan as any)?.eventDate as Date | null | undefined;
		if (eventDate && (kind === "holiday" || kind === "carnival")) {
			return eventDate.getFullYear();
		}
	}

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
	const monthNumber = (MONTHS as MonthKey[]).indexOf(month) + 1;

	const [allocation, allIncome, allExpenses, allSpending, debtPayments, nonIncomeExpensePaymentsAgg] = await Promise.all([
		getMonthlyAllocationSnapshot(budgetPlanId, month, { year }),
		getAllIncome(budgetPlanId, year),
		getAllExpenses(budgetPlanId, year),
		getAllSpending(budgetPlanId),
		getPaymentsByMonth(budgetPlanId, month, year),
		monthNumber >= 1 && monthNumber <= 12
			? prisma.expensePayment.aggregate({
				where: {
					expense: { budgetPlanId, year, month: monthNumber },
					source: { in: ["savings", "emergency", "extra_untracked"] },
				},
				_sum: { amount: true },
			})
			: Promise.resolve(null),
	]);

	const incomeTotal = sumAmounts(allIncome[month] ?? []);
	const expenseTotal = sumAmounts(allExpenses[month] ?? []);
	const debtPaymentsTotal = sumAmounts(debtPayments ?? []);
	const spendingTotal = sumAmounts((allSpending ?? []).filter((s) => s.month === month));
	const nonIncomeExpensePaymentsTotal = Number(
		((nonIncomeExpensePaymentsAgg as any)?._sum?.amount as any)?.toString?.() ??
			(nonIncomeExpensePaymentsAgg as any)?._sum?.amount ??
			0
	);

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
		plannedInvestments +
		nonIncomeExpensePaymentsTotal;

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
