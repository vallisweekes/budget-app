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

export async function getAllExpenses(budgetPlanId: string, year: number = currentYear()): Promise<ExpensesByMonth> {
	const empty = emptyExpensesByMonth();
	const rows = await prisma.expense.findMany({
		where: { budgetPlanId, year },
		orderBy: [{ month: "asc" }, { createdAt: "asc" }],
		select: {
			id: true,
			name: true,
			amount: true,
			paid: true,
			paidAmount: true,
			month: true,
			categoryId: true,
			dueDate: true,
		},
	});

	for (const row of rows) {
		const monthKey = monthNumberToKey(row.month);
		empty[monthKey].push({
			id: row.id,
			name: row.name,
			amount: decimalToNumber(row.amount),
			categoryId: row.categoryId ?? undefined,
			paid: row.paid,
			paidAmount: decimalToNumber(row.paidAmount),
			dueDate: row.dueDate ?? undefined,
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
  const created = await prisma.expense.create({
    data: {
      budgetPlanId,
      year,
      month: monthKeyToNumber(month),
      name: normalizeExpenseName(item.name),
      amount: item.amount,
      paid: !!item.paid,
      paidAmount: item.paidAmount ?? (item.paid ? item.amount : 0),
      categoryId: item.categoryId ?? null,
      dueDate: item.dueDate ?? null,
    },
    select: {
      id: true,
      name: true,
      amount: true,
      paid: true,
      paidAmount: true,
      categoryId: true,
      dueDate: true,
    },
  });

  return {
    id: created.id,
    name: created.name,
    amount: decimalToNumber(created.amount),
    categoryId: created.categoryId ?? undefined,
    paid: created.paid,
    paidAmount: decimalToNumber(created.paidAmount),
    dueDate: created.dueDate ?? undefined,
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
				data: {
					name: targetName,
					amount: item.amount,
					categoryId: item.categoryId ?? null,
					paid: !!item.paid,
					paidAmount: item.paidAmount ?? (item.paid ? item.amount : 0),
					dueDate: item.dueDate ?? null,
				},
			});
			continue;
		}

		await prisma.expense.create({
			data: {
				budgetPlanId,
				year,
				month: monthNumber,
				name: targetName,
				amount: item.amount,
				categoryId: item.categoryId ?? null,
				paid: !!item.paid,
				paidAmount: item.paidAmount ?? (item.paid ? item.amount : 0),
				dueDate: item.dueDate ?? null,
			},
		});
	}
}

export async function updateExpense(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  updates: Partial<Pick<ExpenseItem, "name" | "amount" | "dueDate">> & { categoryId?: string | null },
	year: number = currentYear()
): Promise<ExpenseItem | null> {
  const existing = await prisma.expense.findFirst({
    where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
    select: {
      id: true,
      name: true,
      amount: true,
      paid: true,
      paidAmount: true,
      categoryId: true,
      dueDate: true,
    },
  });
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

  const updated = await prisma.expense.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      amount: nextAmount,
      categoryId: nextCategoryId === undefined ? undefined : nextCategoryId,
      paidAmount: nextPaidAmount,
      paid: nextPaid,
      dueDate: updates.dueDate === undefined ? undefined : (updates.dueDate ?? null),
    },
    select: {
      id: true,
      name: true,
      amount: true,
      paid: true,
      paidAmount: true,
      categoryId: true,
      dueDate: true,
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    amount: decimalToNumber(updated.amount),
    categoryId: updated.categoryId ?? undefined,
    paid: updated.paid,
    paidAmount: decimalToNumber(updated.paidAmount),
    dueDate: updated.dueDate ?? undefined,
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

  const existing = await prisma.expense.findFirst({
    where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
    select: { id: true, name: true, amount: true, paidAmount: true, paid: true, categoryId: true },
  });
  if (!existing) return null;

  const amount = decimalToNumber(existing.amount);
  const currentPaid = decimalToNumber(existing.paidAmount);
  const nextPaidAmount = Math.min(amount, Math.max(0, currentPaid + paymentDelta));
  const nextPaid = nextPaidAmount >= amount;

  const updated = await prisma.expense.update({
    where: { id: existing.id },
    data: {
      paidAmount: nextPaid ? amount : nextPaidAmount,
      paid: nextPaid,
    },
    select: { id: true, name: true, amount: true, paidAmount: true, paid: true, categoryId: true },
  });

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

  const existing = await prisma.expense.findFirst({
    where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
    select: { id: true, name: true, amount: true, paidAmount: true, paid: true, categoryId: true },
  });
  if (!existing) return null;

  const amount = decimalToNumber(existing.amount);
  const nextPaidAmount = Math.min(amount, paidAmount);
  const nextPaid = nextPaidAmount >= amount;

  const updated = await prisma.expense.update({
    where: { id: existing.id },
    data: {
      paidAmount: nextPaid ? amount : nextPaidAmount,
      paid: nextPaid,
    },
    select: { id: true, name: true, amount: true, paidAmount: true, paid: true, categoryId: true },
  });

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
