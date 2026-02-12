import fs from "node:fs/promises";
import path from "node:path";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";
import { ensureBudgetDataDir, getBudgetDataFilePath } from "@/lib/storage/budgetDataPath";

export interface IncomeItem {
  id: string;
  name: string;
  amount: number;
}

export type IncomeByMonth = Record<MonthKey, IncomeItem[]>;

function getFilePath(budgetPlanId: string) {
  return getBudgetDataFilePath(budgetPlanId, "income.monthly.json");
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

export async function getAllIncome(budgetPlanId: string): Promise<IncomeByMonth> {
	const empty: IncomeByMonth = MONTHS.reduce((acc, m) => {
		acc[m] = [];
		return acc;
	}, {} as IncomeByMonth);
	return readJson(getFilePath(budgetPlanId), empty);
}

export async function addIncome(budgetPlanId: string, month: MonthKey, item: Omit<IncomeItem, "id"> & { id?: string }): Promise<void> {
  const data = await getAllIncome(budgetPlanId);
  const id = item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  data[month].push({ id, name: item.name, amount: item.amount });
  await ensureBudgetDataDir(budgetPlanId);
  await writeJson(getFilePath(budgetPlanId), data);
}

export async function updateIncome(budgetPlanId: string, month: MonthKey, id: string, updates: Partial<Omit<IncomeItem, "id">>): Promise<void> {
  const data = await getAllIncome(budgetPlanId);
  const index = data[month].findIndex((e) => e.id === id);
  if (index >= 0) {
    data[month][index] = { ...data[month][index], ...updates };
    await ensureBudgetDataDir(budgetPlanId);
    await writeJson(getFilePath(budgetPlanId), data);
  }
}

export async function removeIncome(budgetPlanId: string, month: MonthKey, id: string): Promise<void> {
  const data = await getAllIncome(budgetPlanId);
  data[month] = data[month].filter((e) => e.id !== id);
  await ensureBudgetDataDir(budgetPlanId);
  await writeJson(getFilePath(budgetPlanId), data);
}
