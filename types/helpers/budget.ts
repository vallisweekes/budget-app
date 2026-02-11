export type MonthKey =
	| "AUGUST "
	| "SEPTEMBER"
	| "OCTOBER"
	| "NOVEMBER"
	| "DECEMBER"
	| "JANUARY"
	| "FEBURARY"
	| "MARCH"
	| "APRIL"
	| "MAY"
	| "JUNE"
	| "JULY";

export type MonthlyAmounts = Partial<Record<MonthKey, number>>;

export interface CategoryInput {
	name: string;
	amounts: MonthlyAmounts;
}

export interface YearInputs {
	yearLabel: string;
	categories: CategoryInput[];
}

export interface CategoryResult {
	name: string;
	monthly: MonthlyAmounts;
	yearTotal: number;
}

export interface YearResult {
	yearLabel: string;
	categories: CategoryResult[];
	subtotal: number;
}
