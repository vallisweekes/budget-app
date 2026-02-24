import type { MonthKey } from "@/types/helpers/budget";

export interface ExpenseItem {
	id: string;
	name: string;
	merchantDomain?: string;
	logoUrl?: string;
	logoSource?: string;
	amount: number;
	categoryId?: string;
	paid?: boolean;
	paidAmount?: number;
	isSaving?: boolean;
	isInvestment?: boolean;
	// If true, this is treated as an allocation/envelope amount rather than a bill.
	// It should never generate an expense-backed debt.
	isAllocation?: boolean;
	// If true, this is a direct debit / standing order — collected automatically.
	isDirectDebit?: boolean;
	dueDate?: string; // ISO date string (YYYY-MM-DD)
}

export type ExpensesByMonth = Record<MonthKey, ExpenseItem[]>;

export type PaymentStatus = "paid" | "unpaid" | "partial";
