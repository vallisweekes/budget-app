import fs from "node:fs/promises";
import path from "node:path";
import { MONTHS } from "@/lib/constants/time";
import type { ExpenseItem, ExpensesByMonth, MonthKey } from "@/types";
import { ensureBudgetDataDir, getBudgetDataFilePath } from "@/lib/storage/budgetDataPath";

export type { ExpenseItem, ExpensesByMonth };

function getFilePath(budgetPlanId: string) {
  return getBudgetDataFilePath(budgetPlanId, "expenses.monthly.json");
}

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(p);
    return JSON.parse(buf.toString());
  } catch (e: any) {
    if (e?.code === "ENOENT") return fallback;
    throw e;
  }
}

async function writeJson<T>(p: string, value: T) {
  await fs.writeFile(p, JSON.stringify(value, null, 2) + "\n");
}

export async function getAllExpenses(budgetPlanId: string): Promise<ExpensesByMonth> {
  const empty: ExpensesByMonth = MONTHS.reduce((acc, m) => {
    acc[m] = [];
    return acc;
  }, {} as ExpensesByMonth);
  const data = await readJson(getFilePath(budgetPlanId), empty);
  return data;
}

export async function addExpense(
	budgetPlanId: string,
	month: MonthKey,
	item: Omit<ExpenseItem, "id"> & { id?: string }
): Promise<ExpenseItem> {
  const data = await getAllExpenses(budgetPlanId);
  const id = item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const created: ExpenseItem = {
    id,
    name: item.name,
    amount: item.amount,
    categoryId: item.categoryId,
    paid: !!item.paid,
    paidAmount: item.paidAmount || 0,
    isSaving: item.isSaving,
    isInvestment: item.isInvestment,
  };
  data[month].push(created);
  await ensureBudgetDataDir(budgetPlanId);
  await writeJson(getFilePath(budgetPlanId), data);
  return created;
}

export async function updateExpense(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  updates: Partial<Pick<ExpenseItem, "name" | "amount">> & { categoryId?: string | null }
): Promise<ExpenseItem | null> {
  const data = await getAllExpenses(budgetPlanId);
  const list = data[month];
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return null;

  const existing = list[idx];
  const nextName = (updates.name ?? existing.name).trim();
  const nextAmount = updates.amount ?? existing.amount;
  const nextCategoryId = updates.categoryId;

  if (!nextName) return null;
  if (!Number.isFinite(nextAmount) || nextAmount < 0) return null;

  const existingPaidAmount = existing.paidAmount ?? 0;
  let nextPaidAmount = existingPaidAmount;

  // If it was marked fully paid, keep it fully paid after amount edits.
  if (existing.paid) {
    nextPaidAmount = nextAmount;
  } else {
    nextPaidAmount = Math.min(existingPaidAmount, nextAmount);
  }

  const nextPaid = nextPaidAmount >= nextAmount && nextAmount > 0;
  if (nextPaid) nextPaidAmount = nextAmount;

  const updated: ExpenseItem = {
    ...existing,
    name: nextName,
    amount: nextAmount,
    categoryId:
      nextCategoryId === undefined ? existing.categoryId : nextCategoryId ? nextCategoryId : undefined,
    paidAmount: nextPaidAmount,
    paid: nextPaid,
  };

  list[idx] = updated;
  await ensureBudgetDataDir(budgetPlanId);
  await writeJson(getFilePath(budgetPlanId), data);
  return updated;
}

export async function toggleExpensePaid(budgetPlanId: string, month: MonthKey, id: string): Promise<void> {
  const data = await getAllExpenses(budgetPlanId);
  const list = data[month];
  const idx = list.findIndex((e) => e.id === id);
  if (idx >= 0) {
    const nextPaid = !list[idx].paid;
    list[idx].paid = nextPaid;
    if (nextPaid) {
      list[idx].paidAmount = list[idx].amount;
    } else {
      list[idx].paidAmount = 0;
    }
  }
  await ensureBudgetDataDir(budgetPlanId);
  await writeJson(getFilePath(budgetPlanId), data);
}

export async function applyExpensePayment(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  paymentDelta: number
): Promise<{ expense: ExpenseItem; remaining: number } | null> {
  if (!Number.isFinite(paymentDelta) || paymentDelta <= 0) return null;

  const data = await getAllExpenses(budgetPlanId);
  const list = data[month];
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return null;

  const expense = list[idx];
  const currentPaid = expense.paidAmount ?? 0;
  const nextPaidAmount = Math.min(expense.amount, Math.max(0, currentPaid + paymentDelta));
  const nextPaid = nextPaidAmount >= expense.amount;

  const updated: ExpenseItem = {
    ...expense,
    paidAmount: nextPaidAmount,
    paid: nextPaid,
  };

  list[idx] = updated;
  await ensureBudgetDataDir(budgetPlanId);
  await writeJson(getFilePath(budgetPlanId), data);

  return { expense: updated, remaining: Math.max(0, updated.amount - (updated.paidAmount ?? 0)) };
}

export async function setExpensePaymentAmount(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  paidAmount: number
): Promise<{ expense: ExpenseItem; remaining: number } | null> {
  if (!Number.isFinite(paidAmount) || paidAmount < 0) return null;

  const data = await getAllExpenses(budgetPlanId);
  const list = data[month];
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return null;

  const expense = list[idx];
  const nextPaidAmount = Math.min(expense.amount, paidAmount);
  const nextPaid = nextPaidAmount >= expense.amount;

  const updated: ExpenseItem = {
    ...expense,
    paidAmount: nextPaidAmount,
    paid: nextPaid,
  };

  list[idx] = updated;
  await ensureBudgetDataDir(budgetPlanId);
  await writeJson(getFilePath(budgetPlanId), data);

  return { expense: updated, remaining: Math.max(0, updated.amount - (updated.paidAmount ?? 0)) };
}

export async function removeExpense(budgetPlanId: string, month: MonthKey, id: string): Promise<void> {
  const data = await getAllExpenses(budgetPlanId);
  data[month] = data[month].filter((e) => e.id !== id);
  await ensureBudgetDataDir(budgetPlanId);
  await writeJson(getFilePath(budgetPlanId), data);
}
