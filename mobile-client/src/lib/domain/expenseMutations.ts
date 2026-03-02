import type { ExpensePaymentSource as ApiExpensePaymentSource } from "@/lib/apiTypes";

export type ExpensePaymentSource = ApiExpensePaymentSource | "other";

type CreateExpenseBodyInput = {
  name: string;
  amount: string;
  month: number;
  year: number;
  paid: boolean;
  isAllocation: boolean;
  isDirectDebit: boolean;
  distributeMonths: boolean;
  distributeYears: boolean;
  paymentSource: ExpensePaymentSource;
  categoryId?: string;
  dueDate?: string;
  budgetPlanId?: string | null;
  cardDebtId?: string;
  seriesKey?: string | null;
};

export function parseExpenseAmount(rawAmount: string): number {
  const parsed = Number.parseFloat(String(rawAmount).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function canSubmitExpense(name: string, rawAmount: string): boolean {
  const parsedAmount = parseExpenseAmount(rawAmount);
  return name.trim().length > 0 && parsedAmount > 0;
}

export function buildCreateExpenseBody(input: CreateExpenseBodyInput): Record<string, unknown> {
  const amount = parseExpenseAmount(input.amount);
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    amount,
    month: input.month,
    year: input.year,
    paid: input.paid,
    isAllocation: input.isAllocation,
    isDirectDebit: input.isDirectDebit,
    distributeMonths: input.distributeMonths,
    distributeYears: input.distributeYears,
    paymentSource: input.paymentSource === "other" ? "extra_untracked" : input.paymentSource,
  };

  if (input.categoryId) body.categoryId = input.categoryId;
  if (input.dueDate?.trim()) body.dueDate = input.dueDate.trim();
  if (input.budgetPlanId) body.budgetPlanId = input.budgetPlanId;
  if (input.paymentSource === "credit_card" && input.cardDebtId) body.cardDebtId = input.cardDebtId;
  if (input.seriesKey) body.seriesKey = input.seriesKey;

  return body;
}

export function buildEditExpenseBody(args: {
  name: string;
  parsedAmount: number;
  categoryId: string;
  dueDate: string;
  isAllocation: boolean;
  isDirectDebit: boolean;
  distributeMonths: boolean;
  distributeYears: boolean;
}): Record<string, unknown> {
  return {
    name: args.name.trim(),
    amount: args.parsedAmount,
    categoryId: args.categoryId,
    dueDate: args.dueDate.trim() ? args.dueDate.trim() : "",
    isAllocation: args.isAllocation,
    isDirectDebit: args.isDirectDebit,
    distributeMonths: args.distributeMonths,
    distributeYears: args.distributeYears,
  };
}
