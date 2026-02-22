export type GoalsBudgetInsights = {
	basisLabel: string;
	monthsUsed: number;
	avgIncomeTotal: number;
	avgExpenseTotal: number;
	avgDebtPaymentsTotal: number;
	avgSpendingTotal: number;
	avgPlannedAllowance: number;
	avgUnallocated: number;
};

export type GoalsByYear = {
	year: number;
	goals: import("@/lib/goals/store").Goal[];
};
