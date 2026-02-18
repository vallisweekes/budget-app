import type { MonthKey } from "@/types";

export type IncomeItem = {
	id: string;
	name: string;
	amount: number;
};

export type IncomeByMonth = Record<MonthKey, IncomeItem[]>;

export type IncomeTabKey = "income" | "allocations";

export type MonthlyAllocationSummaryRow = {
	month: MonthKey;
	year: number;
	grossIncome: number;
	fixedTotal: number;
	customTotal: number;
	total: number;
	leftToBudget: number;
	customCount: number;
};
