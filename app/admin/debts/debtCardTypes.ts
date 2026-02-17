import type { DebtType } from "@/types";

export interface DebtCardDebt {
	id: string;
	name: string;
	type: DebtType;
	initialBalance: number;
	currentBalance: number;
	amount: number;
	paid: boolean;
	paidAmount: number;
	monthlyMinimum?: number;
	interestRate?: number;
	installmentMonths?: number;
	createdAt: string;
	sourceType?: "expense";
	sourceExpenseId?: string;
	sourceMonthKey?: string;
	sourceCategoryName?: string;
	sourceExpenseName?: string;
}
