import "server-only";

import { MONTHS } from "@/lib/constants/time";
import { prisma } from "@/lib/prisma";
import { monthKeyToNumber, monthNumberToKey } from "@/lib/helpers/monthKey";
import type { ExpenseItem, ExpensesByMonth, MonthKey } from "@/types";

export type { ExpenseItem, ExpensesByMonth };

function currentYear(): number {
  return new Date().getFullYear();
}

function emptyExpensesByMonth(): ExpensesByMonth {
  return MONTHS.reduce((acc, m) => {
    acc[m] = [];
    return acc;
  }, {} as ExpensesByMonth);
}

function normalizeExpenseName(name: string): string {
	return String(name ?? "").trim();
}

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	return Number((value as any).toString?.() ?? value);
}

function dueDateForYearMonthFromISO(iso: string, year: number, monthNumber: number): Date {
  // Keep the *day of month* from `iso`, but apply it to the given year/month.
  // Clamp to the last day of the target month (e.g. Feb 30 -> Feb 28/29).
  const parts = String(iso).split("-");
  const day = Number(parts[2]);
  const safeDay = Number.isFinite(day) ? day : 1;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const clampedDay = Math.min(Math.max(1, safeDay), lastDay);
  return new Date(Date.UTC(year, monthNumber - 1, clampedDay));
}

export async function updateExpenseAcrossMonthsByName(
  budgetPlanId: string,
  match: { name: string; categoryId: string | null },
  updates: { name: string; amount: number; categoryId?: string | null; dueDate?: string; isAllocation?: boolean },
  year: number,
  months: MonthKey[]
): Promise<void> {
  const targetMonths = Array.from(new Set(months));
  const matchName = normalizeExpenseName(match.name);
  const nextName = normalizeExpenseName(updates.name);
  if (!matchName || !nextName) return;
  if (!Number.isFinite(updates.amount) || updates.amount < 0) return;

  for (const month of targetMonths) {
    const monthNumber = monthKeyToNumber(month);
    const rows = await prisma.expense.findMany({
      where: {
        budgetPlanId,
        year,
        month: monthNumber,
        name: { equals: matchName, mode: "insensitive" },
        categoryId: match.categoryId,
      },
      select: { id: true, paid: true, paidAmount: true, amount: true },
    });

    for (const row of rows) {
      const nextAmount = updates.amount;
      const existingPaidAmount = decimalToNumber(row.paidAmount);
      let nextPaidAmount = existingPaidAmount;
      if (row.paid) {
        nextPaidAmount = nextAmount;
      } else {
        nextPaidAmount = Math.min(existingPaidAmount, nextAmount);
      }

      const nextPaid = nextPaidAmount >= nextAmount && nextAmount > 0;
      if (nextPaid) nextPaidAmount = nextAmount;

      const dueDateValue =
        updates.dueDate === undefined
          ? undefined
          : updates.dueDate
            ? dueDateForYearMonthFromISO(updates.dueDate, year, monthNumber)
            : null;

      await prisma.expense.update({
        where: { id: row.id },
        data: ({
          name: nextName,
          amount: nextAmount,
          categoryId: updates.categoryId === undefined ? undefined : updates.categoryId,
          paidAmount: nextPaidAmount,
          paid: nextPaid,
          isAllocation: updates.isAllocation === undefined ? undefined : !!updates.isAllocation,
          dueDate: dueDateValue,
        }) as any,
      });
    }
  }
}

export async function getAllExpenses(budgetPlanId: string, year: number = currentYear()): Promise<ExpensesByMonth> {
	const empty = emptyExpensesByMonth();
  type ExpenseListRow = {
    id: string;
    name: string;
    amount: unknown;
    paid: boolean;
    paidAmount: unknown;
    isAllocation: boolean;
    month: number;
    categoryId: string | null;
    dueDate: Date | null;
  };

  const rows = (await prisma.expense.findMany({
		where: { budgetPlanId, year },
		orderBy: [{ month: "asc" }, { createdAt: "asc" }],
		select: {
			id: true,
			name: true,
			amount: true,
			paid: true,
			paidAmount: true,
      isAllocation: true,
			month: true,
			categoryId: true,
			dueDate: true,
		},
  } as any)) as unknown as ExpenseListRow[];

	for (const row of rows) {
		const monthKey = monthNumberToKey(row.month);
		empty[monthKey].push({
			id: row.id,
			name: row.name,
			amount: decimalToNumber(row.amount),
			categoryId: row.categoryId ?? undefined,
			paid: row.paid,
			paidAmount: decimalToNumber(row.paidAmount),
      isAllocation: row.isAllocation,
			dueDate: row.dueDate ? row.dueDate.toISOString().split('T')[0] : undefined,
		});
	}

	return empty;
}

export async function addExpense(
	budgetPlanId: string,
	month: MonthKey,
  item: Omit<ExpenseItem, "id"> & { id?: string },
  year: number = currentYear()
): Promise<ExpenseItem> {
  const created = (await prisma.expense.create({
    data: ({
      budgetPlanId,
      year,
      month: monthKeyToNumber(month),
      name: normalizeExpenseName(item.name),
      amount: item.amount,
      paid: !!item.paid,
      paidAmount: item.paidAmount ?? (item.paid ? item.amount : 0),
			isAllocation: !!item.isAllocation,
      categoryId: item.categoryId ?? null,
      dueDate: item.dueDate ? new Date(item.dueDate) : null,
    }) as any,
    select: {
      id: true,
      name: true,
      amount: true,
      paid: true,
      paidAmount: true,
			isAllocation: true,
      categoryId: true,
      dueDate: true,
    },
  } as any)) as any;

  return {
    id: created.id,
    name: created.name,
    amount: decimalToNumber(created.amount),
    categoryId: created.categoryId ?? undefined,
    paid: created.paid,
    paidAmount: decimalToNumber(created.paidAmount),
		isAllocation: created.isAllocation,
    dueDate: created.dueDate ? created.dueDate.toISOString().split('T')[0] : undefined,
  };
}

export async function addOrUpdateExpenseAcrossMonths(
  budgetPlanId: string,
  year: number,
  months: MonthKey[],
  item: Omit<ExpenseItem, "id"> & { id?: string }
): Promise<void> {
	const targetMonths = Array.from(new Set(months));
	const targetName = normalizeExpenseName(item.name);

	for (const month of targetMonths) {
		const monthNumber = monthKeyToNumber(month);
		const existing = await prisma.expense.findFirst({
			where: {
				budgetPlanId,
				year,
				month: monthNumber,
				name: { equals: targetName, mode: "insensitive" },
			},
			select: { id: true },
		});

		if (existing) {
			await prisma.expense.update({
				where: { id: existing.id },
        data: ({
					name: targetName,
					amount: item.amount,
					categoryId: item.categoryId ?? null,
					paid: !!item.paid,
					paidAmount: item.paidAmount ?? (item.paid ? item.amount : 0),
          isAllocation: !!item.isAllocation,
					dueDate: item.dueDate ? new Date(item.dueDate) : null,
        }) as any,
			});
			continue;
		}

		await prisma.expense.create({
      data: ({
				budgetPlanId,
				year,
				month: monthNumber,
				name: targetName,
				amount: item.amount,
				categoryId: item.categoryId ?? null,
				paid: !!item.paid,
				paidAmount: item.paidAmount ?? (item.paid ? item.amount : 0),
        isAllocation: !!item.isAllocation,
				dueDate: item.dueDate ? new Date(item.dueDate) : null,
      }) as any,
		});
	}
}

export async function updateExpense(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
	updates: Partial<Pick<ExpenseItem, "name" | "amount" | "dueDate" | "isAllocation">> & { categoryId?: string | null },
	year: number = currentYear()
): Promise<ExpenseItem | null> {
  const existing = (await prisma.expense.findFirst({
    where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
    select: {
      id: true,
      name: true,
      amount: true,
      paid: true,
      paidAmount: true,
			isAllocation: true,
      categoryId: true,
      dueDate: true,
    },
  } as any)) as any;
  if (!existing) return null;

  const nextName = normalizeExpenseName(updates.name ?? existing.name);
  const nextAmount = updates.amount ?? decimalToNumber(existing.amount);
  const nextCategoryId = updates.categoryId;

  if (!nextName) return null;
  if (!Number.isFinite(nextAmount) || nextAmount < 0) return null;

  const existingPaidAmount = decimalToNumber(existing.paidAmount);
  let nextPaidAmount = existingPaidAmount;
  if (existing.paid) {
    nextPaidAmount = nextAmount;
  } else {
    nextPaidAmount = Math.min(existingPaidAmount, nextAmount);
  }

  const nextPaid = nextPaidAmount >= nextAmount && nextAmount > 0;
  if (nextPaid) nextPaidAmount = nextAmount;

  const updated = (await prisma.expense.update({
    where: { id: existing.id },
    data: ({
      name: nextName,
      amount: nextAmount,
      categoryId: nextCategoryId === undefined ? undefined : nextCategoryId,
      paidAmount: nextPaidAmount,
      paid: nextPaid,
			isAllocation: updates.isAllocation === undefined ? undefined : !!updates.isAllocation,
      dueDate: updates.dueDate === undefined ? undefined : (updates.dueDate ? new Date(updates.dueDate) : null),
    }) as any,
    select: {
      id: true,
      name: true,
      amount: true,
      paid: true,
      paidAmount: true,
			isAllocation: true,
      categoryId: true,
      dueDate: true,
    },
  } as any)) as any;

  return {
    id: updated.id,
    name: updated.name,
    amount: decimalToNumber(updated.amount),
    categoryId: updated.categoryId ?? undefined,
    paid: updated.paid,
    paidAmount: decimalToNumber(updated.paidAmount),
		isAllocation: updated.isAllocation,
    dueDate: updated.dueDate ? updated.dueDate.toISOString().split('T')[0] : undefined,
  };
}

export async function toggleExpensePaid(
	budgetPlanId: string,
	month: MonthKey,
	id: string,
	year: number = currentYear()
): Promise<void> {
  const existing = await prisma.expense.findFirst({
    where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
    select: { id: true, paid: true, amount: true },
  });
  if (!existing) return;
  const nextPaid = !existing.paid;
  await prisma.expense.update({
    where: { id: existing.id },
    data: {
      paid: nextPaid,
      paidAmount: nextPaid ? existing.amount : 0,
    },
  });
}

export async function applyExpensePayment(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  paymentDelta: number,
	year: number = currentYear()
): Promise<{ expense: ExpenseItem; remaining: number } | null> {
  if (!Number.isFinite(paymentDelta) || paymentDelta <= 0) return null;

  const existing = (await prisma.expense.findFirst({
    where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
		select: { id: true, name: true, amount: true, paidAmount: true, paid: true, categoryId: true, isAllocation: true },
  } as any)) as any;
  if (!existing) return null;

  const amount = decimalToNumber(existing.amount);
  const currentPaid = decimalToNumber(existing.paidAmount);
  const nextPaidAmount = Math.min(amount, Math.max(0, currentPaid + paymentDelta));
  const nextPaid = nextPaidAmount >= amount;

  const updated = (await prisma.expense.update({
    where: { id: existing.id },
    data: {
      paidAmount: nextPaid ? amount : nextPaidAmount,
      paid: nextPaid,
    },
		select: { id: true, name: true, amount: true, paidAmount: true, paid: true, categoryId: true, isAllocation: true },
  } as any)) as any;

  const updatedAmount = decimalToNumber(updated.amount);
  const updatedPaidAmount = decimalToNumber(updated.paidAmount);

  return {
    expense: {
      id: updated.id,
      name: updated.name,
      amount: updatedAmount,
      categoryId: updated.categoryId ?? undefined,
      paid: updated.paid,
      paidAmount: updatedPaidAmount,
			isAllocation: updated.isAllocation,
    },
    remaining: Math.max(0, updatedAmount - updatedPaidAmount),
  };
}

export async function setExpensePaymentAmount(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  paidAmount: number,
	year: number = currentYear()
): Promise<{ expense: ExpenseItem; remaining: number } | null> {
  if (!Number.isFinite(paidAmount) || paidAmount < 0) return null;

  const existing = (await prisma.expense.findFirst({
    where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
		select: { id: true, name: true, amount: true, paidAmount: true, paid: true, categoryId: true, isAllocation: true },
  } as any)) as any;
  if (!existing) return null;

  const amount = decimalToNumber(existing.amount);
  const nextPaidAmount = Math.min(amount, paidAmount);
  const nextPaid = nextPaidAmount >= amount;

  const updated = (await prisma.expense.update({
    where: { id: existing.id },
    data: {
      paidAmount: nextPaid ? amount : nextPaidAmount,
      paid: nextPaid,
    },
		select: { id: true, name: true, amount: true, paidAmount: true, paid: true, categoryId: true, isAllocation: true },
  } as any)) as any;

  const updatedAmount = decimalToNumber(updated.amount);
  const updatedPaidAmount = decimalToNumber(updated.paidAmount);

  return {
    expense: {
      id: updated.id,
      name: updated.name,
      amount: updatedAmount,
      categoryId: updated.categoryId ?? undefined,
      paid: updated.paid,
      paidAmount: updatedPaidAmount,
			isAllocation: updated.isAllocation,
    },
    remaining: Math.max(0, updatedAmount - updatedPaidAmount),
  };
}

export async function removeExpense(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  year: number = currentYear()
): Promise<void> {
	await prisma.expense.deleteMany({
		where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
	});
}
