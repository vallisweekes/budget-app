import type { ExpensePaymentSource as ApiExpensePaymentSource } from "@/lib/apiTypes";
import { paymentSourceForFunding, type ExpenseFundingSource } from "@/lib/domain/expenseFunding";

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
  fundingSource: ExpenseFundingSource;
  categoryId?: string;
  dueDate?: string;
  budgetPlanId?: string | null;
  selectedDebtId?: string;
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
  const paymentSource = paymentSourceForFunding(input.fundingSource);
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
    fundingSource: input.fundingSource,
    paymentSource,
  };

  if (input.categoryId) body.categoryId = input.categoryId;
  if (input.dueDate?.trim()) body.dueDate = input.dueDate.trim();
  if (input.budgetPlanId) body.budgetPlanId = input.budgetPlanId;
  if (input.fundingSource === "credit_card" && input.selectedDebtId) {
    body.cardDebtId = input.selectedDebtId;
    body.debtId = input.selectedDebtId;
  }
  if (input.fundingSource === "loan" && input.selectedDebtId) {
    body.debtId = input.selectedDebtId;
  }
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
  fundingSource?: ExpenseFundingSource;
  selectedDebtId?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: args.name.trim(),
    amount: args.parsedAmount,
    categoryId: args.categoryId,
    dueDate: args.dueDate.trim() ? args.dueDate.trim() : "",
    isAllocation: args.isAllocation,
    isDirectDebit: args.isDirectDebit,
    distributeMonths: args.distributeMonths,
    distributeYears: args.distributeYears,
  };

  if (args.fundingSource) {
    body.fundingSource = args.fundingSource;
    body.paymentSource = paymentSourceForFunding(args.fundingSource);
    if (args.fundingSource === "credit_card") {
      body.cardDebtId = args.selectedDebtId?.trim() || null;
      body.debtId = args.selectedDebtId?.trim() || null;
    }
    if (args.fundingSource === "loan") {
      body.debtId = args.selectedDebtId?.trim() || null;
    }
  }

  return body;
}
