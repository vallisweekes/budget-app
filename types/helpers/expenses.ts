import type { MonthKey } from "@/types/helpers/budget";

export interface ExpenseItem {
	id: string;
	name: string;
	amount: number;
	categoryId?: string;
	paid?: boolean;
	paidAmount?: number;
	isSaving?: boolean;
	isInvestment?: boolean;
	dueDate?: string; // ISO date string (YYYY-MM-DD)
}

export type ExpensesByMonth = Record<MonthKey, ExpenseItem[]>;

export type PaymentStatus = "paid" | "unpaid" | "partial";
