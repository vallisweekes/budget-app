import { prisma } from "@/lib/prisma";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
import { getMonthlyDebtPlan } from "@/lib/helpers/finance/getMonthlyDebtPlan";
import { getAllIncome, getIncomeForAnchorMonth } from "@/lib/income/store";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import { supportsExpenseMovedToDebtField } from "@/lib/prisma/capabilities";
import { getPayPeriodExpenses, includeInPlannedExpenseTotals } from "@/lib/helpers/finance/payPeriodExpenses";
import { getPayPeriodAnchorFromWindow, resolveActivePayPeriodWindow, type PayFrequency } from "@/lib/payPeriods";
import { getPeriodKey } from "@/lib/helpers/periodKey";
import type { ExpenseItem } from "@/types";

let supportsDashboardIsMovedToDebtField: boolean | null = null;

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
	const isUnknownMovedToDebtFieldError = (error: unknown) => {
		const message = String((error as { message?: unknown })?.message ?? error);
		return (
			message.includes("isMovedToDebt") &&
			(message.includes("Unknown arg") ||
				message.includes("Unknown argument") ||
				message.includes("Unknown field"))
		);
	};

	const ensureDefaultCategories = opts?.ensureDefaultCategories ?? true;
	// Keep category defaults in sync even if the DB predates new defaults.
	if (ensureDefaultCategories) {
		await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: planId });
	}

	const selectedYear = now.getFullYear();
	const selectedMonthNum = now.getMonth() + 1; // 1-12
	const selectedMonthKey = monthNumberToKey(selectedMonthNum);

	const expensesPromise = (async () => {
		const runLegacyQuery = () =>
			prisma.expense.findMany({
				where: { budgetPlanId: planId, year: selectedYear, month: selectedMonthNum },
			});

		if (supportsDashboardIsMovedToDebtField === false || !(await supportsExpenseMovedToDebtField())) {
			supportsDashboardIsMovedToDebtField = false;
			return runLegacyQuery();
		}

		try {
			const rows = await prisma.expense.findMany({
				where: {
					budgetPlanId: planId,
					year: selectedYear,
					month: selectedMonthNum,
					isMovedToDebt: false,
				},
			});
			supportsDashboardIsMovedToDebtField = true;
			return rows;
		} catch (error) {
			// If Prisma Client wasn't regenerated yet, this field won't exist.
			// Fall back to the legacy query rather than 500'ing the whole dashboard.
			if (isUnknownMovedToDebtFieldError(error)) {
				supportsDashboardIsMovedToDebtField = false;
				return runLegacyQuery();
			}
			throw error;
		}
	})();

	const [categories, expenses, income, goals, allocation, customAllocations, debtPlan] =
		await Promise.all([
			prisma.category.findMany({ where: { budgetPlanId: planId } }),
			expensesPromise,
			prisma.income.findMany({
				where: { budgetPlanId: planId, year: selectedYear, month: selectedMonthNum },
			}),
			prisma.goal.findMany({ where: { budgetPlanId: planId } }),
			getMonthlyAllocationSnapshot(planId, selectedMonthKey, { year: selectedYear }),
			getMonthlyCustomAllocationsSnapshot(planId, selectedMonthKey, { year: selectedYear }),
			getMonthlyDebtPlan({
				budgetPlanId: planId,
				year: selectedYear,
				month: selectedMonthNum,
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

	const budgetedExpenses = regularExpenses.filter((expense, index) =>
		includeInPlannedExpenseTotals(expenses[index] as { isExtraLoggedExpense?: boolean | null; paymentSource?: string | null })
	);

	const monthIncome = income.map((i) => ({
		id: i.id,
		name: i.name,
		amount: Number(i.amount),
	}));

	const categoryTotals = budgetedExpenses.reduce((acc, e) => {
		if (e.categoryId) {
			acc[e.categoryId] = (acc[e.categoryId] || 0) + e.amount;
		}
		return acc;
	}, {} as Record<string, number>);

	const uncategorizedExpenses = budgetedExpenses.filter((e) => !e.categoryId);
	const uncategorizedTotal = uncategorizedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

	const expensesByCategory = budgetedExpenses.reduce((acc, e) => {
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

	const plannedDebtAmount = debtPlan.plannedDebtPayments;
	const customSetAsideTotal = Number(customAllocations.total ?? 0);

	const totalExpenses = budgetedExpenses.reduce((a, b) => a + (b.amount || 0), 0);
	const totalIncome = monthIncome.reduce((a, b) => a + (b.amount || 0), 0);
	const remaining = totalIncome - totalExpenses;

	// Include custom sacrifice items so this matches the income-month BFF calculation
	const totalAllocations =
		(allocation.monthlyAllowance ?? 0) +
		(allocation.monthlySavingsContribution ?? 0) +
		(allocation.monthlyEmergencyContribution ?? 0) +
		(allocation.monthlyInvestmentContribution ?? 0) +
		customSetAsideTotal;

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

function parseIsoDateOnlyToUtc(iso: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
	const [y, m, d] = iso.split("-").map(Number);
	if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
	return new Date(Date.UTC(y, m - 1, d));
}

function inRangeUtc(target: Date, start: Date, end: Date): boolean {
	return target.getTime() >= start.getTime() && target.getTime() <= end.getTime();
}

function normalizeSeriesOrName(seriesKey: unknown, name: unknown): string {
	const raw = typeof seriesKey === "string" && seriesKey.trim().length > 0
		? seriesKey
		: typeof name === "string"
			? name
			: "";
	return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseIsoYearMonth(iso: string): { year: number; month: number } | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
	const [y, m] = iso.split("-").slice(0, 2).map(Number);
	if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
	return { year: y, month: m };
}

function normalizeIncomeKey(name: unknown): string {
	return String(name ?? "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

/**
 * Pay-period-aware version of dashboard plan data.
 *
 * - Income/allocations/debt plans are taken from the pay-period anchor month.
 * - Expenses are filtered to only those due within the active pay-period window.
 */
export async function getDashboardPlanDataForActivePayPeriod(
	planId: string,
	params: {
		now: Date;
		payDate: number;
		payFrequency: PayFrequency;
		planCreatedAt?: Date | null;
		ensureDefaultCategories?: boolean;
	}
): Promise<DashboardPlanData> {
	const { now, payDate, payFrequency, planCreatedAt } = params;
	const ensureDefaultCategories = params.ensureDefaultCategories ?? true;

	// Keep category defaults in sync even if the DB predates new defaults.
	if (ensureDefaultCategories) {
		await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: planId });
	}

	const window = resolveActivePayPeriodWindow({
		now,
		payDate: Number.isFinite(payDate) && payDate >= 1 ? Math.floor(payDate) : 1,
		payFrequency,
		planCreatedAt,
	});

	const anchor = getPayPeriodAnchorFromWindow({ window, payFrequency });

	// Monthly snapshots (income, allocations, debt plan) remain month-based,
	// and should correspond to the canonical pay-period anchor month.
	const selectedYear = anchor.anchorYear;
	const selectedMonthNum = anchor.anchorMonth;
	const selectedMonthKey = monthNumberToKey(selectedMonthNum);
	const startYear = window.start.getUTCFullYear();
	const startMonthNum = window.start.getUTCMonth() + 1;
	const startMonthKey = monthNumberToKey(startMonthNum);
	const isUnknownMovedToDebtFieldError = (error: unknown) => {
		const message = String((error as { message?: unknown })?.message ?? error);
		return (
			message.includes("isMovedToDebt") &&
			(message.includes("Unknown arg") ||
				message.includes("Unknown argument") ||
				message.includes("Unknown field"))
		);
	};

	const [categories, expenses, income, goals, allocation, customAllocations, debtPlan] =
		await Promise.all([
			prisma.category.findMany({ where: { budgetPlanId: planId } }),
			getPayPeriodExpenses({
				budgetPlanId: planId,
				windowStart: window.start,
				windowEnd: window.end,
				payDate,
			}),
			(async () => {
				if (payFrequency === "monthly") {
					return getIncomeForAnchorMonth({
						budgetPlanId: planId,
						year: selectedYear,
						month: selectedMonthNum,
					});
				}

				const incomeByMonth = await getAllIncome(planId, selectedYear);
				return incomeByMonth[selectedMonthKey] ?? [];
			})(),
			prisma.goal.findMany({ where: { budgetPlanId: planId } }),
			getMonthlyAllocationSnapshot(planId, selectedMonthKey, { year: selectedYear }),
			getMonthlyCustomAllocationsSnapshot(planId, selectedMonthKey, { year: selectedYear }),
			getMonthlyDebtPlan({
				budgetPlanId: planId,
				year: selectedYear,
				month: selectedMonthNum,
				periodKey: getPeriodKey(window.start, payDate),
				periodStart: window.start,
				periodEnd: window.end,
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

	const regularExpenses: ExpenseItem[] = expenses.map((e) => ({
		id: e.id,
		name: e.name,
		merchantDomain: e.merchantDomain ?? undefined,
		logoUrl: e.logoUrl ?? undefined,
		logoSource: e.logoSource ?? undefined,
		amount: Number(e.amount),
		paid: e.paid,
		paidAmount: Number(e.paidAmount),
		categoryId: e.categoryId ?? undefined,
		isAllocation: Boolean(e.isAllocation ?? false),
		isDirectDebit: Boolean(e.isDirectDebit ?? false),
		dueDate: e.dueDate instanceof Date ? e.dueDate.toISOString().slice(0, 10) : undefined,
	}));

	const monthIncome = (income as any[]).map((i) => ({
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
	}, {} as Record<string, ExpenseItem[]>);

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

	const plannedDebtAmount = debtPlan.plannedDebtPayments;
	const customSetAsideTotal = Number(customAllocations.total ?? 0);
	const totalExpenses = regularExpenses.reduce((a, b) => a + (b.amount || 0), 0);
	const totalIncome = monthIncome.reduce((a, b) => a + (b.amount || 0), 0);
	const remaining = totalIncome - totalExpenses;

	const totalAllocations =
		(allocation.monthlyAllowance ?? 0) +
		(allocation.monthlySavingsContribution ?? 0) +
		(allocation.monthlyEmergencyContribution ?? 0) +
		(allocation.monthlyInvestmentContribution ?? 0) +
		customSetAsideTotal;

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
