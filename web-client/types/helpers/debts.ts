export type DebtType = "credit_card" | "store_card" | "loan" | "mortgage" | "hire_purchase" | "other";

export interface DebtItem {
	id: string;
	name: string;
	logoUrl?: string;
	type: DebtType;
	creditLimit?: number;
	dueDay?: number;
	dueDate?: string;
	initialBalance: number;
	currentBalance: number;
	monthlyMinimum?: number;
	interestRate?: number;
	paid: boolean;
	paidAmount: number;
	amount: number;
	installmentMonths?: number;
	createdAt: string;
	defaultPaymentSource?: "income" | "extra_funds" | "credit_card";
	defaultPaymentCardDebtId?: string;
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
	source?: "income" | "extra_funds" | "credit_card";
	cardDebtId?: string;
}
