import type { Expense } from "@/lib/apiTypes";
import { registerSessionScopedResetter } from "@/lib/sessionScopedState";

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

export function upsertCachedPayPeriodExpense(
  params: { budgetPlanId: string | null | undefined; month: number; year: number },
  expense: Expense,
  options?: { prepend?: boolean },
) {
  const existing = getCachedPayPeriodExpenses(params) ?? [];
  const next = existing.filter((entry) => entry.id !== expense.id);

  if (options?.prepend === false) {
    next.push(expense);
  } else {
    next.unshift(expense);
  }

  setCachedPayPeriodExpenses(params, next);
}

export function replaceCachedPayPeriodExpense(
  params: { budgetPlanId: string | null | undefined; month: number; year: number },
  currentId: string,
  expense: Expense,
) {
  const existing = getCachedPayPeriodExpenses(params) ?? [];
  const next = existing.filter((entry) => entry.id !== currentId && entry.id !== expense.id);
  const currentIndex = existing.findIndex((entry) => entry.id === currentId);

  if (currentIndex < 0) {
    next.unshift(expense);
  } else {
    next.splice(Math.min(currentIndex, next.length), 0, expense);
  }

  setCachedPayPeriodExpenses(params, next);
}

export function removeCachedPayPeriodExpense(
  params: { budgetPlanId: string | null | undefined; month: number; year: number },
  expenseId: string,
) {
  const existing = getCachedPayPeriodExpenses(params);
  if (!existing) return;
  setCachedPayPeriodExpenses(params, existing.filter((entry) => entry.id !== expenseId));
}

export function clearCachedPayPeriodExpenses() {
  payPeriodExpensesCache.clear();
}

registerSessionScopedResetter(clearCachedPayPeriodExpenses);