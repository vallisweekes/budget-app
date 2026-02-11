export type DebtType = "credit_card" | "loan" | "high_purchase";

export interface DebtItem {
	id: string;
	name: string;
	type: DebtType;
	initialBalance: number;
	currentBalance: number;
	monthlyMinimum?: number;
	interestRate?: number;
	paid: boolean;
	paidAmount: number;
	amount: number;
	createdAt: string;
	sourceType?: "expense";
	sourceExpenseId?: string;
	sourceMonthKey?: string;
	sourceYear?: number;
	sourceCategoryId?: string;
	sourceCategoryName?: string;
	sourceExpenseName?: string;
}

export interface DebtPayment {
	id: string;
	debtId: string;
	amount: number;
	date: string;
	month: string;
}
