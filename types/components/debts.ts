import type { DebtType } from "../helpers/debts";

export interface DebtCardDebt {
	id: string;
	name: string;
	type: DebtType;
	creditLimit?: number;
	dueDay?: number;
	initialBalance: number;
	currentBalance: number;
	amount: number;
	paid: boolean;
	paidAmount: number;
	monthlyMinimum?: number;
	interestRate?: number;
	installmentMonths?: number;
	createdAt: string;
	defaultPaymentSource?: "income" | "extra_funds" | "credit_card";
	defaultPaymentCardDebtId?: string;
	sourceType?: "expense";
	sourceExpenseId?: string;
	sourceMonthKey?: string;
	sourceCategoryName?: string;
	sourceExpenseName?: string;
}
