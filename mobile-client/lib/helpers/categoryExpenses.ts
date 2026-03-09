import type { Expense } from "@/lib/apiTypes";
import { T } from "@/lib/theme";

export function expenseCacheKey(planId: string | null, month: number, year: number): string {
  return `${planId ?? "none"}:${year}-${month}`;
}

export function dueDaysColor(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return T.red;
  if (days <= 7) return T.orange;
  return T.green;
}

export function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function splitCategoryExpenses(allExpenses: Expense[], categoryId: string): {
  main: Expense[];
  logged: Expense[];
} {
  const isUncategorisedBucket = categoryId === "__none__";
  const matchingCategory = allExpenses.filter((expense) => (isUncategorisedBucket ? !expense.categoryId : expense.categoryId === categoryId));
  return {
    main: matchingCategory.filter((entry) => !entry.isExtraLoggedExpense || entry.paymentSource === "income"),
    logged: matchingCategory.filter((entry) => entry.isExtraLoggedExpense && entry.paymentSource !== "income"),
  };
}

export function getLatestPaymentAt(expenses: Expense[]): string | null {
  let best: string | null = null;
  for (const expense of expenses) {
    if (!expense.lastPaymentAt) continue;
    if (!best || new Date(expense.lastPaymentAt).getTime() > new Date(best).getTime()) {
      best = expense.lastPaymentAt;
    }
  }
  return best;
}
