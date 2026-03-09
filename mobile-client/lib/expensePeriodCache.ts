import type { Expense } from "@/lib/apiTypes";

const payPeriodExpensesCache = new Map<string, Expense[]>();

function cacheKey(params: { budgetPlanId: string | null | undefined; month: number; year: number }) {
  return `${params.budgetPlanId ?? "none"}:${params.year}-${params.month}:pay_period`;
}

export function getCachedPayPeriodExpenses(params: {
  budgetPlanId: string | null | undefined;
  month: number;
  year: number;
}): Expense[] | null {
  return payPeriodExpensesCache.get(cacheKey(params)) ?? null;
}

export function setCachedPayPeriodExpenses(
  params: { budgetPlanId: string | null | undefined; month: number; year: number },
  expenses: Expense[]
) {
  payPeriodExpensesCache.set(cacheKey(params), Array.isArray(expenses) ? expenses : []);
}

export function clearCachedPayPeriodExpenses() {
  payPeriodExpensesCache.clear();
}