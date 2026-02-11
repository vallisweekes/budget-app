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

export const MONTHS: MonthKey[] = [
  "AUGUST ",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
  "JANUARY",
  "FEBURARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
];

export type MonthlyAmounts = Partial<Record<MonthKey, number>>;

export interface CategoryInput {
  name: string;
  amounts: MonthlyAmounts; // per-month amounts
}

export interface YearInputs {
  yearLabel: string; // e.g. "2026 - 2027"
  categories: CategoryInput[]; // e.g. RENT, MORTGAGE, COUNCIL TAX, etc.
}

export interface CategoryResult {
  name: string;
  monthly: MonthlyAmounts;
  yearTotal: number;
}

export interface YearResult {
  yearLabel: string;
  categories: CategoryResult[];
  subtotal: number; // sum of all category totals
}

export function sumMonths(amounts: MonthlyAmounts): number {
  return MONTHS.reduce((acc, m) => acc + (amounts[m] ?? 0), 0);
}

export function computeCategory(input: CategoryInput): CategoryResult {
  return {
    name: input.name,
    monthly: input.amounts,
    yearTotal: sumMonths(input.amounts),
  };
}

export function computeYear(inputs: YearInputs): YearResult {
  const categories = inputs.categories.map(computeCategory);
  const subtotal = categories.reduce((acc, c) => acc + c.yearTotal, 0);
  return { yearLabel: inputs.yearLabel, categories, subtotal };
}

// Convenience: build category input from a flat monthly number
export function fixedMonthly(name: string, value: number): CategoryInput {
  const amounts: MonthlyAmounts = {};
  for (const m of MONTHS) amounts[m] = value;
  return { name, amounts };
}

// Example: utilities bundle aggregator
export function computeBundleTotal(categories: CategoryResult[]): number {
  return categories.reduce((acc, c) => acc + c.yearTotal, 0);
}
