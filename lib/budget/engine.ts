import { MONTHS } from "@/lib/constants/time";
import type { CategoryInput, CategoryResult, MonthKey, MonthlyAmounts, YearInputs, YearResult } from "@/types";

export { MONTHS };
export type { CategoryInput, CategoryResult, MonthKey, MonthlyAmounts, YearInputs, YearResult };

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
