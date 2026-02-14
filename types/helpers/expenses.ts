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
	dueDate?: number; // Day of month (1-31), defaults to payDate from settings
}

export type ExpensesByMonth = Record<MonthKey, ExpenseItem[]>;

export type PaymentStatus = "paid" | "unpaid" | "partial";
