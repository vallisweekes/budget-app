import type { Expense } from "@/lib/apiTypes";
import type { UpcomingExpense } from "@/types";

function startOfLocalDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getDaysUntilDue(dueDate: string | null | undefined, now: Date): number {
  if (!dueDate) return Number.POSITIVE_INFINITY;

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((startOfLocalDay(parsed).getTime() - startOfLocalDay(now).getTime()) / msPerDay);
}

function getExpenseUrgency(daysUntilDue: number): UpcomingExpense["urgency"] {
  if (!Number.isFinite(daysUntilDue)) return undefined;
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "today";
  if (daysUntilDue <= 7) return "soon";
  return undefined;
}

function mapExpenseToUpcomingItem(expense: Expense, now: Date): UpcomingExpense {
  const amount = Number(expense.amount ?? 0);
  const paidAmount = Number(expense.paidAmount ?? 0);
  const dueDate = expense.effectiveDueDate ?? expense.dueDate ?? null;
  const daysUntilDue = getDaysUntilDue(dueDate, now);

  return {
    id: expense.id,
    name: expense.name,
    amount,
    paidAmount,
    dueDate,
    logoUrl: expense.logoUrl ?? null,
    daysUntilDue,
    urgency: getExpenseUrgency(daysUntilDue),
  };
}

export function buildFallbackUpcomingExpenses(expenses: Expense[], now: Date = new Date()): UpcomingExpense[] {
  return expenses
    .map((expense) => mapExpenseToUpcomingItem(expense, now))
    .filter((expense) => (expense.amount - (expense.paidAmount ?? 0)) > 0.0001)
    .sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;

      const aRemaining = a.amount - (a.paidAmount ?? 0);
      const bRemaining = b.amount - (b.paidAmount ?? 0);
      if (aRemaining !== bRemaining) return bRemaining - aRemaining;

      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
}