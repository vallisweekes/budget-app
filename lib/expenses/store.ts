import fs from "node:fs/promises";
import path from "node:path";
import { MONTHS, MonthKey } from "../budget/engine";

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  categoryId?: string;
  paid?: boolean;
  paidAmount?: number;
  isSaving?: boolean;
  isInvestment?: boolean;
}

export type ExpensesByMonth = Record<MonthKey, ExpenseItem[]>;

const filePath = path.join(process.cwd(), "data", "expenses.monthly.json");

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

export async function getAllExpenses(): Promise<ExpensesByMonth> {
  const empty: ExpensesByMonth = MONTHS.reduce((acc, m) => {
    acc[m] = [];
    return acc;
  }, {} as ExpensesByMonth);
  const data = await readJson(filePath, empty);
  return data;
}

export async function addExpense(month: MonthKey, item: Omit<ExpenseItem, "id"> & { id?: string }): Promise<void> {
  const data = await getAllExpenses();
  const id = item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  data[month].push({ id, name: item.name, amount: item.amount, categoryId: item.categoryId, paid: !!item.paid, paidAmount: item.paidAmount || 0, isSaving: item.isSaving, isInvestment: item.isInvestment });
  await writeJson(filePath, data);
}

export async function toggleExpensePaid(month: MonthKey, id: string): Promise<void> {
  const data = await getAllExpenses();
  const list = data[month];
  const idx = list.findIndex((e) => e.id === id);
  if (idx >= 0) list[idx].paid = !list[idx].paid;
  await writeJson(filePath, data);
}

export async function removeExpense(month: MonthKey, id: string): Promise<void> {
  const data = await getAllExpenses();
  data[month] = data[month].filter((e) => e.id !== id);
  await writeJson(filePath, data);
}
