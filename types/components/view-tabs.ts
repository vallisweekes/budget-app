import type { DebtItem } from "@/types/helpers/debts";
import type { ExpenseItem, PaymentStatus } from "@/types/helpers/expenses";
import type { MonthKey } from "@/types/helpers/budget";
import type { LargestExpensesForPlan } from "@/lib/helpers/dashboard/getLargestExpensesByPlan";
import type { PreviousMonthRecap, UpcomingPayment, RecapTip } from "@/lib/expenses/insights";

export type GoalLike = {
	id: string;
	title: string;
	targetAmount?: number;
	currentAmount?: number;
	type: "yearly" | "long-term" | "long_term" | "short_term" | "short-term";
	category: "debt" | "savings" | "emergency" | "investment" | "other";
	targetYear?: number;
	description?: string;
};

export type CategoryDataItem = {
	id: string;
	name: string;
	icon?: string;
	color?: string;
	total: number;
	expenses: ExpenseItem[];
};

export type TabKey = "personal" | "holiday" | "carnival";

export type BudgetPlan = {
	id: string;
	name: string;
	kind: TabKey | string;
	payDate: number;
	budgetHorizonYears?: number;
	createdAt?: string;
};

export type BudgetPlanData = {
	categoryData: CategoryDataItem[];
	totalIncome: number;
	totalAllocations: number;
	plannedDebtPayments: number;
	plannedSavingsContribution: number;
	plannedEmergencyContribution: number;
	plannedInvestments: number;
	incomeAfterAllocations: number;
	totalExpenses: number;
	remaining: number;
	goals: GoalLike[];
};

export type ViewTabsProps = {
	budgetPlanId: string;
	month: MonthKey;
	categoryData: CategoryDataItem[];
	regularExpenses: ExpenseItem[];
	totalIncome: number;
	totalAllocations: number;
	plannedDebtPayments: number;
	plannedSavingsContribution: number;
	plannedEmergencyContribution: number;
	plannedInvestments: number;
	incomeAfterAllocations: number;
	totalExpenses: number;
	remaining: number;
	debts: DebtItem[];
	totalDebtBalance: number;
	goals: GoalLike[];
	homepageGoalIds?: string[];
	incomeMonthsCoverageByPlan?: Record<string, number>;
	allPlansData?: Record<string, BudgetPlanData>;
	largestExpensesByPlan?: Record<string, LargestExpensesForPlan>;
	expenseInsights?: {
		recap: PreviousMonthRecap;
		upcoming: UpcomingPayment[];
		recapTips?: RecapTip[];
	};
};

export type GoalsSubTabKey = "overview" | "projection";

export type MonthlyAssumptions = {
	savings: number;
	emergency: number;
	investments: number;
};

export type MonthlyAssumptionsDraft = {
	savings: string;
	emergency: string;
	investments: string;
};

export type DashboardCategoryTotal = {
	name: string;
	total: number;
	color?: string;
};

export type DashboardCombinedData = {
	totalIncome: number;
	totalAllocations: number;
	plannedDebtPayments: number;
	incomeAfterAllocations: number;
	totalExpenses: number;
	remaining: number;
	amountLeftToBudget: number;
	plannedSavingsContribution: number;
	plannedEmergencyContribution: number;
	plannedInvestments: number;
	categoryTotals: DashboardCategoryTotal[];
	goals: GoalLike[];
	flattenedExpenses: ExpenseItem[];
};

export type LargestExpenseSection = {
	key: "personal" | "carnival" | "holiday";
	label: string;
	items: Array<{ id: string; name: string; amount: number }>;
};

export type LargestExpensesCardModel = {
	title: string;
	sections: LargestExpenseSection[];
	flat: Array<{ id: string; name: string; amount: number }>;
	showEventDivider: boolean;
};

export type UpdatePaymentStatusFn = (
	planId: string,
	monthKey: MonthKey,
	id: string,
	status: PaymentStatus,
	partialAmount?: number
) => Promise<void>;
