import { prisma } from "@/lib/prisma";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getMonthlyAllocationSnapshot } from "@/lib/allocations/store";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import type { ExpenseItem } from "@/types";

export type DashboardGoalLike = {
	id: string;
	title: string;
	type: "yearly" | "long-term" | "long_term" | "short_term" | "short-term";
	category: "debt" | "savings" | "emergency" | "investment" | "other";
	description?: string;
	targetAmount?: number;
	currentAmount?: number;
	targetYear?: number;
};

export type DashboardCategoryDataItem = {
	id: string;
	name: string;
	icon?: string;
	color?: string;
	total: number;
	expenses: ExpenseItem[];
};

export type DashboardPlanData = {
	year: number;
	monthNum: number;
	categoryData: DashboardCategoryDataItem[];
	totalIncome: number;
	totalAllocations: number;
	plannedDebtPayments: number;
	plannedSavingsContribution: number;
	plannedEmergencyContribution: number;
	plannedInvestments: number;
	incomeAfterAllocations: number;
	totalExpenses: number;
	remaining: number;
	goals: DashboardGoalLike[];
};

export async function getDashboardPlanData(
	planId: string,
	now: Date,
	opts?: { ensureDefaultCategories?: boolean }
): Promise<DashboardPlanData> {
	const ensureDefaultCategories = opts?.ensureDefaultCategories ?? true;
	// Keep category defaults in sync even if the DB predates new defaults.
	if (ensureDefaultCategories) {
		await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: planId });
	}

	const selectedYear = now.getFullYear();
	const selectedMonthNum = now.getMonth() + 1; // 1-12
	const selectedMonthKey = monthNumberToKey(selectedMonthNum);

	const [categories, expenses, income, goals, allocation, debtPaymentsAgg, plannedDebtPayments] =
		await Promise.all([
			prisma.category.findMany({ where: { budgetPlanId: planId } }),
			prisma.expense.findMany({
				where: { budgetPlanId: planId, year: selectedYear, month: selectedMonthNum },
			}),
			prisma.income.findMany({
				where: { budgetPlanId: planId, year: selectedYear, month: selectedMonthNum },
			}),
			prisma.goal.findMany({ where: { budgetPlanId: planId } }),
			getMonthlyAllocationSnapshot(planId, selectedMonthKey, { year: selectedYear }),
			prisma.debtPayment.aggregate({
				where: {
					debt: { budgetPlanId: planId },
					year: selectedYear,
					month: selectedMonthNum,
					source: "income",
				},
				_sum: { amount: true },
			}),
			prisma.debt.aggregate({
				where: { budgetPlanId: planId, currentBalance: { gt: 0 } },
				_sum: { amount: true },
			}),
		]);

	const serializedGoals: DashboardGoalLike[] = goals.map((g) => ({
		id: g.id,
		title: g.title,
		type: g.type,
		category: g.category,
		description: g.description ?? undefined,
		targetAmount: g.targetAmount == null ? undefined : Number(g.targetAmount),
		currentAmount: g.currentAmount == null ? undefined : Number(g.currentAmount),
		targetYear: g.targetYear ?? undefined,
	}));

	const categoryLookup = categories.reduce(
		(acc, cat) => {
			acc[cat.id] = cat;
			return acc;
		},
		{} as Record<string, (typeof categories)[number]>
	);

	const regularExpenses = expenses.map((e) => ({
		id: e.id,
		name: e.name,
		amount: Number(e.amount),
		paid: e.paid,
		paidAmount: Number(e.paidAmount),
		categoryId: e.categoryId ?? undefined,
	}));

	const monthIncome = income.map((i) => ({
		id: i.id,
		name: i.name,
		amount: Number(i.amount),
	}));

	const categoryTotals = regularExpenses.reduce((acc, e) => {
		if (e.categoryId) {
			acc[e.categoryId] = (acc[e.categoryId] || 0) + e.amount;
		}
		return acc;
	}, {} as Record<string, number>);

	const uncategorizedExpenses = regularExpenses.filter((e) => !e.categoryId);
	const uncategorizedTotal = uncategorizedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

	const expensesByCategory = regularExpenses.reduce((acc, e) => {
		if (e.categoryId) {
			if (!acc[e.categoryId]) acc[e.categoryId] = [];
			acc[e.categoryId].push(e);
		}
		return acc;
	}, {} as Record<string, typeof regularExpenses>);

	const categoryData: DashboardCategoryDataItem[] = Object.entries(categoryTotals)
		.map(([catId, total]) => ({
			...categoryLookup[catId],
			icon: categoryLookup[catId]?.icon ?? undefined,
			color: categoryLookup[catId]?.color ?? undefined,
			total,
			expenses: expensesByCategory[catId] || [],
		}))
		.filter((c) => c.name)
		.sort((a, b) => b.total - a.total);

	if (uncategorizedTotal > 0) {
		categoryData.push({
			id: "uncategorized",
			name: "Miscellaneous",
			icon: "Circle",
			color: "slate",
			total: uncategorizedTotal,
			expenses: uncategorizedExpenses,
		});
		categoryData.sort((a, b) => b.total - a.total);
	}

	const debtPaymentsFromIncome = Number(
		debtPaymentsAgg._sum.amount?.toString?.() ?? debtPaymentsAgg._sum.amount ?? 0
	);
	const plannedDebtAmount = Number(
		plannedDebtPayments._sum.amount?.toString?.() ?? plannedDebtPayments._sum.amount ?? 0
	);

	const totalExpenses = regularExpenses.reduce((a, b) => a + (b.amount || 0), 0);
	const totalIncome = monthIncome.reduce((a, b) => a + (b.amount || 0), 0);
	const remaining = totalIncome - totalExpenses;

	const totalAllocations =
		(allocation.monthlyAllowance ?? 0) +
		(allocation.monthlySavingsContribution ?? 0) +
		(allocation.monthlyEmergencyContribution ?? 0) +
		(allocation.monthlyInvestmentContribution ?? 0);

	const plannedSavingsContribution = allocation.monthlySavingsContribution ?? 0;
	const plannedEmergencyContribution = allocation.monthlyEmergencyContribution ?? 0;
	const plannedInvestments = allocation.monthlyInvestmentContribution ?? 0;

	const incomeAfterAllocations = totalIncome - totalAllocations - plannedDebtAmount;

	return {
		year: selectedYear,
		monthNum: selectedMonthNum,
		categoryData,
		totalIncome,
		totalAllocations,
		plannedDebtPayments: plannedDebtAmount,
		plannedSavingsContribution,
		plannedEmergencyContribution,
		plannedInvestments,
		incomeAfterAllocations,
		totalExpenses,
		remaining,
		goals: serializedGoals,
	};
}
