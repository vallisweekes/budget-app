import { MONTHS } from "@/lib/constants/time";
import { prisma } from "@/lib/prisma";
import { monthKeyToNumber, monthNumberToKey } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";

export interface IncomeItem {
  id: string;
  name: string;
  amount: number;
}

export type IncomeByMonth = Record<MonthKey, IncomeItem[]>;

function emptyIncomeByMonth(): IncomeByMonth {
	return MONTHS.reduce((acc, m) => {
		acc[m] = [];
		return acc;
	}, {} as IncomeByMonth);
}

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	return Number((value as any).toString?.() ?? value);
}

async function resolveIncomeYear(budgetPlanId: string): Promise<number> {
	const latest = await prisma.income.findFirst({
		where: { budgetPlanId },
		orderBy: [{ year: "desc" }, { month: "desc" }],
		select: { year: true },
	});
	return latest?.year ?? new Date().getFullYear();
}

export async function getAllIncome(budgetPlanId: string, year?: number): Promise<IncomeByMonth> {
  const empty = emptyIncomeByMonth();
  const resolvedYear = year ?? (await resolveIncomeYear(budgetPlanId));
  const rows = await prisma.income.findMany({
    where: { budgetPlanId, year: resolvedYear },
    orderBy: [{ month: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, amount: true, month: true },
  });

  for (const row of rows) {
    const monthKey = monthNumberToKey(row.month);
    empty[monthKey].push({ id: row.id, name: row.name, amount: decimalToNumber(row.amount) });
  }

  return empty;
}

export async function addIncome(budgetPlanId: string, month: MonthKey, item: Omit<IncomeItem, "id"> & { id?: string }): Promise<void> {
  const year = await resolveIncomeYear(budgetPlanId);
  await prisma.income.create({
    data: {
      budgetPlanId,
      year,
      month: monthKeyToNumber(month),
      name: item.name,
      amount: item.amount,
    },
  });
}

function normalizeIncomeName(name: string): string {
  return String(name ?? "").trim().toLowerCase();
}

export async function addOrUpdateIncomeAcrossMonths(
  budgetPlanId: string,
  months: MonthKey[],
  item: Omit<IncomeItem, "id"> & { id?: string }
): Promise<void> {
  const year = await resolveIncomeYear(budgetPlanId);
  const targetMonths = Array.from(new Set(months));
  const targetName = normalizeIncomeName(item.name);

  for (const monthKey of targetMonths) {
    const month = monthKeyToNumber(monthKey);
    const existing = await prisma.income.findFirst({
      where: {
        budgetPlanId,
        year,
        month,
        name: { equals: targetName, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.income.update({
        where: { id: existing.id },
        data: { name: item.name, amount: item.amount },
      });
      continue;
    }

    await prisma.income.create({
      data: { budgetPlanId, year, month, name: item.name, amount: item.amount },
    });
  }
}

export async function updateIncome(budgetPlanId: string, month: MonthKey, id: string, updates: Partial<Omit<IncomeItem, "id">>): Promise<void> {
	const year = await resolveIncomeYear(budgetPlanId);
	await prisma.income.updateMany({
		where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
		data: updates,
	});
}

export async function removeIncome(budgetPlanId: string, month: MonthKey, id: string): Promise<void> {
	const year = await resolveIncomeYear(budgetPlanId);
	await prisma.income.deleteMany({
		where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
	});
}
