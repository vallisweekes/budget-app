import type { MonthKey } from "@/types";
import type { DeleteExpenseScopeOptions } from "@/types/expenses-manager";

export type ExpenseManagerActions = {
	addExpenseAction: (data: FormData) => Promise<void>;
	applyExpensePaymentAction: (
		budgetPlanId: string,
		month: MonthKey,
		expenseId: string,
		paymentAmount: number,
		year?: number
	) => Promise<{ success: boolean; error?: string }>;
	removeExpenseAction: (
		budgetPlanId: string,
		month: MonthKey,
		expenseId: string,
		year?: number,
		scope?: DeleteExpenseScopeOptions
	) => Promise<void>;
	togglePaidAction: (budgetPlanId: string, month: MonthKey, expenseId: string, year?: number) => Promise<void>;
	updateExpenseAction: (data: FormData) => Promise<void>;
};
