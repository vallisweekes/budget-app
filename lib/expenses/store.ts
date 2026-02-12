import fs from "node:fs/promises";
import { MONTHS } from "@/lib/constants/time";
import type { ExpenseItem, ExpensesByMonth, MonthKey } from "@/types";
import { ensureBudgetDataDir, getBudgetDataFilePath } from "@/lib/storage/budgetDataPath";

export type { ExpenseItem, ExpensesByMonth };

function getFilePath(budgetPlanId: string) {
  return getBudgetDataFilePath(budgetPlanId, "expenses.byYear.json");
}

function getLegacyFilePath(budgetPlanId: string) {
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

function currentYear(): number {
  return new Date().getFullYear();
}

function emptyExpensesByMonth(): ExpensesByMonth {
  return MONTHS.reduce((acc, m) => {
    acc[m] = [];
    return acc;
  }, {} as ExpensesByMonth);
}

type ExpensesByYear = Record<string, ExpensesByMonth>;

async function getAllExpensesByYear(budgetPlanId: string): Promise<ExpensesByYear> {
  const empty: ExpensesByYear = {};
  const primaryPath = getFilePath(budgetPlanId);
  const legacyPath = getLegacyFilePath(budgetPlanId);

  try {
    const buf = await fs.readFile(primaryPath);
    const data = JSON.parse(buf.toString()) as ExpensesByYear;
    for (const yearKey of Object.keys(data)) {
      const yearData = data[yearKey] ?? ({} as ExpensesByMonth);
      for (const m of MONTHS) {
        yearData[m] = yearData[m] ?? [];
      }
      data[yearKey] = yearData;
    }
    return data;
  } catch (e: any) {
    if (e?.code !== "ENOENT") throw e;
  }

  // New file doesn't exist yet; fall back to legacy monthly file (single-year).
  try {
    const legacy = await readJson(legacyPath, emptyExpensesByMonth());
    return { [String(currentYear())]: legacy };
  } catch (e: any) {
    if (e?.code === "ENOENT") return empty;
    throw e;
  }
}

export async function getAllExpenses(budgetPlanId: string, year: number = currentYear()): Promise<ExpensesByMonth> {
  const allYears = await getAllExpensesByYear(budgetPlanId);
  const yearKey = String(year);
  return allYears[yearKey] ?? emptyExpensesByMonth();
}

async function writeAllExpensesByYear(budgetPlanId: string, data: ExpensesByYear): Promise<void> {
  await ensureBudgetDataDir(budgetPlanId);
  await writeJson(getFilePath(budgetPlanId), data);
}

function normalizeExpenseName(name: string): string {
  return String(name ?? "").trim().toLowerCase();
}

export async function addExpense(
	budgetPlanId: string,
	month: MonthKey,
  item: Omit<ExpenseItem, "id"> & { id?: string },
  year: number = currentYear()
): Promise<ExpenseItem> {
  const allYears = await getAllExpensesByYear(budgetPlanId);
  const yearKey = String(year);
  const data = allYears[yearKey] ?? emptyExpensesByMonth();
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
  allYears[yearKey] = data;
  await writeAllExpensesByYear(budgetPlanId, allYears);
  return created;
}

export async function addOrUpdateExpenseAcrossMonths(
  budgetPlanId: string,
  year: number,
  months: MonthKey[],
  item: Omit<ExpenseItem, "id"> & { id?: string }
): Promise<void> {
  const allYears = await getAllExpensesByYear(budgetPlanId);
  const yearKey = String(year);
  const data = allYears[yearKey] ?? emptyExpensesByMonth();
  const id = item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const targetMonths = Array.from(new Set(months));
  const targetName = normalizeExpenseName(item.name);

  for (const month of targetMonths) {
    const list = data[month] ?? [];
    const existingIndex = list.findIndex((e) => normalizeExpenseName(e.name) === targetName);
    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      list[existingIndex] = {
        ...existing,
        name: item.name,
        amount: item.amount,
        categoryId: item.categoryId,
        paid: item.paid,
        paidAmount: item.paidAmount,
        isSaving: item.isSaving,
        isInvestment: item.isInvestment,
      };
    } else {
      list.push({
        id,
        name: item.name,
        amount: item.amount,
        categoryId: item.categoryId,
        paid: item.paid,
        paidAmount: item.paidAmount,
        isSaving: item.isSaving,
        isInvestment: item.isInvestment,
      });
    }
    data[month] = list;
  }

  allYears[yearKey] = data;
  await writeAllExpensesByYear(budgetPlanId, allYears);
}

export async function updateExpense(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  updates: Partial<Pick<ExpenseItem, "name" | "amount">> & { categoryId?: string | null },
	year: number = currentYear()
): Promise<ExpenseItem | null> {
	const allYears = await getAllExpensesByYear(budgetPlanId);
	const yearKey = String(year);
	const data = allYears[yearKey] ?? emptyExpensesByMonth();
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
	allYears[yearKey] = data;
	await writeAllExpensesByYear(budgetPlanId, allYears);
  return updated;
}

export async function toggleExpensePaid(
	budgetPlanId: string,
	month: MonthKey,
	id: string,
	year: number = currentYear()
): Promise<void> {
	const allYears = await getAllExpensesByYear(budgetPlanId);
	const yearKey = String(year);
	const data = allYears[yearKey] ?? emptyExpensesByMonth();
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
	allYears[yearKey] = data;
	await writeAllExpensesByYear(budgetPlanId, allYears);
}

export async function applyExpensePayment(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  paymentDelta: number,
	year: number = currentYear()
): Promise<{ expense: ExpenseItem; remaining: number } | null> {
  if (!Number.isFinite(paymentDelta) || paymentDelta <= 0) return null;

	const allYears = await getAllExpensesByYear(budgetPlanId);
	const yearKey = String(year);
	const data = allYears[yearKey] ?? emptyExpensesByMonth();
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
	allYears[yearKey] = data;
	await writeAllExpensesByYear(budgetPlanId, allYears);

  return { expense: updated, remaining: Math.max(0, updated.amount - (updated.paidAmount ?? 0)) };
}

export async function setExpensePaymentAmount(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  paidAmount: number,
	year: number = currentYear()
): Promise<{ expense: ExpenseItem; remaining: number } | null> {
  if (!Number.isFinite(paidAmount) || paidAmount < 0) return null;

	const allYears = await getAllExpensesByYear(budgetPlanId);
	const yearKey = String(year);
	const data = allYears[yearKey] ?? emptyExpensesByMonth();
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
  allYears[yearKey] = data;
  await writeAllExpensesByYear(budgetPlanId, allYears);

  return { expense: updated, remaining: Math.max(0, updated.amount - (updated.paidAmount ?? 0)) };
}

export async function removeExpense(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  year: number = currentYear()
): Promise<void> {
  const allYears = await getAllExpensesByYear(budgetPlanId);
  const yearKey = String(year);
  const data = allYears[yearKey] ?? emptyExpensesByMonth();
  data[month] = data[month].filter((e) => e.id !== id);
  allYears[yearKey] = data;
  await writeAllExpensesByYear(budgetPlanId, allYears);
}
