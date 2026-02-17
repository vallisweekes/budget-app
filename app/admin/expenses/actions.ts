"use server";

import { revalidatePath } from "next/cache";
import {
  addOrUpdateExpenseAcrossMonths,
  toggleExpensePaid,
  updateExpense,
  updateExpenseAcrossMonthsByName,
  removeExpense,
  applyExpensePayment,
  setExpensePaymentAmount,
} from "@/lib/expenses/store";
import { isNonDebtCategoryName } from "@/lib/expenses/helpers";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";
import { getSettings } from "@/lib/settings/store";
import { upsertExpenseDebt } from "@/lib/debts/store";

function isTruthyFormValue(value: FormDataEntryValue | null): boolean {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

function isTruthyFormField(formData: FormData, name: string): boolean {
	const values = formData.getAll(name);
	if (!values.length) return false;
	return values.some((v) => isTruthyFormValue(v));
}

function toYear(value: FormDataEntryValue | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildAllowedBudgetYears(horizonYears: number, nowYear: number): number[] {
	const safeHorizon = Number.isFinite(horizonYears) && horizonYears > 0 ? Math.floor(horizonYears) : 10;
	return Array.from({ length: safeHorizon }, (_, i) => nowYear + i);
}

function remainingMonthsFrom(month: MonthKey): MonthKey[] {
  const idx = (MONTHS as MonthKey[]).indexOf(month);
  if (idx < 0) return [month];
  return (MONTHS as MonthKey[]).slice(idx);
}

async function requireYearWithinBudgetHorizon(
  budgetPlanId: string,
  year: number
): Promise<{ allowedYears: number[]; nowYear: number }> {
  const settings = await getSettings(budgetPlanId);
  const nowYear = new Date().getFullYear();
  const allowedYears = buildAllowedBudgetYears(settings.budgetHorizonYears ?? 10, nowYear);
  if (!allowedYears.includes(year)) {
    throw new Error(`Year ${year} is outside your budget horizon.`);
  }
  return { allowedYears, nowYear };
}

async function requireAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const sessionUsername = sessionUser?.username ?? sessionUser?.name;
  if (!sessionUser || !sessionUsername) throw new Error("Not authenticated");
  const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
  return { userId, username: sessionUsername };
}

function userScopedPagePath(params: { username: string; budgetPlanId: string; page: string }): string {
	const { username, budgetPlanId, page } = params;
	return `/user=${encodeURIComponent(username)}/${encodeURIComponent(budgetPlanId)}/page=${encodeURIComponent(page)}`;
}

function revalidateBudgetPlanViews(params: { username: string; budgetPlanId: string }) {
	const { username, budgetPlanId } = params;
	revalidatePath(userScopedPagePath({ username, budgetPlanId, page: "home" }));
	revalidatePath(userScopedPagePath({ username, budgetPlanId, page: "expenses" }));
	// Spending tiles/insights often depend on expenses too.
	revalidatePath(userScopedPagePath({ username, budgetPlanId, page: "spending" }));
}

async function requireOwnedBudgetPlan(budgetPlanId: string, userId: string) {
  const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { id: true, userId: true } });
  if (!plan || plan.userId !== userId) throw new Error("Budget plan not found");
  return plan;
}

function requireBudgetPlanId(formData: FormData): string {
  const raw = formData.get("budgetPlanId");
  const budgetPlanId = String(raw ?? "").trim();
  if (!budgetPlanId) throw new Error("Missing budgetPlanId");
  return budgetPlanId;
}

async function syncExistingExpenseDebt(params: {
  budgetPlanId: string;
  expenseId: string;
  fallbackMonthKey: MonthKey;
  year?: number;
}) {
  const { budgetPlanId, expenseId, fallbackMonthKey, year } = params;
  const existingDebt = await prisma.debt.findFirst({
    where: { budgetPlanId, sourceType: "expense", sourceExpenseId: expenseId },
    select: { sourceMonthKey: true },
  });
  if (!existingDebt) return;

  const y = year ?? new Date().getFullYear();
  type ExpenseDebtSyncRow = {
    id: string;
    name: string;
    amount: { toString(): string };
    paidAmount: { toString(): string };
    isAllocation: boolean;
    categoryId: string | null;
    category: { name: string } | null;
  };

  const expense = (await prisma.expense.findFirst({
    where: { id: expenseId, budgetPlanId, year: y },
    select: {
      id: true,
      name: true,
      amount: true,
      paidAmount: true,
      isAllocation: true,
      categoryId: true,
      category: { select: { name: true } },
    } as any,
  } as any)) as ExpenseDebtSyncRow | null;
  if (!expense) return;

  const amountNumber = Number(expense.amount.toString());
  const paidAmountNumber = Number(expense.paidAmount.toString());
  const remainingAmount = expense.isAllocation ? 0 : Math.max(0, amountNumber - paidAmountNumber);

  await upsertExpenseDebt({
    budgetPlanId,
    expenseId: expense.id,
    monthKey: (existingDebt.sourceMonthKey as MonthKey) ?? fallbackMonthKey,
    expenseName: expense.name,
    categoryId: expense.categoryId ?? undefined,
    categoryName: expense.category?.name ?? undefined,
    remainingAmount,
  });
}

export async function addExpenseAction(formData: FormData): Promise<void> {
	const budgetPlanId = requireBudgetPlanId(formData);
	const month = String(formData.get("month")) as MonthKey;
	const year = toYear(formData.get("year")) ?? new Date().getFullYear();
	const name = String(formData.get("name") || "").trim();
	const amount = Number(formData.get("amount") || 0);
	const categoryId = String(formData.get("categoryId") || "") || undefined;
	const paid = String(formData.get("paid") || "false") === "true";
  let isAllocation = isTruthyFormField(formData, "isAllocation");

	// Auto-mark Food/Transport categories as allocations
	if (categoryId) {
		const category = await prisma.category.findUnique({
			where: { id: categoryId },
			select: { name: true },
		});
		if (category && isNonDebtCategoryName(category.name)) {
			isAllocation = true;
		}
	}

	if (!name || !month) return;

	const distributeMonths = isTruthyFormValue(formData.get("distributeMonths"));
	const distributeYears = isTruthyFormValue(formData.get("distributeYears"));
	const targetMonths: MonthKey[] = distributeMonths ? (MONTHS as MonthKey[]) : [month];
	const sharedId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const { userId, username } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const { allowedYears } = await requireYearWithinBudgetHorizon(budgetPlanId, year);
	const targetYears: number[] = distributeYears ? allowedYears : [year];

	for (const y of targetYears) {
		await addOrUpdateExpenseAcrossMonths(budgetPlanId, y, targetMonths, {
			id: sharedId,
			name,
			amount,
			categoryId,
			paid,
			paidAmount: paid ? amount : 0,
      isAllocation,
		});
	}

  revalidateBudgetPlanViews({ username, budgetPlanId });
}

export async function togglePaidAction(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  year?: number
): Promise<void> {
	const { userId, username } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
  await toggleExpensePaid(budgetPlanId, month, id, year);
	await syncExistingExpenseDebt({ budgetPlanId, expenseId: id, fallbackMonthKey: month, year });
	revalidateBudgetPlanViews({ username, budgetPlanId });
}

export async function updateExpenseAction(formData: FormData): Promise<void> {
  const budgetPlanId = requireBudgetPlanId(formData);
  const month = String(formData.get("month")) as MonthKey;
  const year = toYear(formData.get("year")) ?? new Date().getFullYear();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const categoryRaw = formData.get("categoryId");
  const categoryString = categoryRaw == null ? undefined : String(categoryRaw);
  const categoryId = categoryString === undefined ? undefined : categoryString.trim() ? categoryString.trim() : null;
  const dueDateRaw = formData.get("dueDate");
  const dueDateString = dueDateRaw == null ? undefined : String(dueDateRaw).trim();
  const dueDate = dueDateString && dueDateString !== "" ? dueDateString : undefined;
  let isAllocation = isTruthyFormField(formData, "isAllocation");

	// Auto-mark Food/Transport categories as allocations
	if (categoryId) {
		const category = await prisma.category.findUnique({
			where: { id: categoryId },
			select: { name: true },
		});
		if (category && isNonDebtCategoryName(category.name)) {
			isAllocation = true;
		}
	}

  if (!month || !id || !name) return;

  const applyRemainingMonths = isTruthyFormValue(formData.get("applyRemainingMonths"));
  const applyFutureYears = isTruthyFormValue(formData.get("applyFutureYears"));

  const { userId, username } = await requireAuthenticatedUser();
  await requireOwnedBudgetPlan(budgetPlanId, userId);

	const horizon = await requireYearWithinBudgetHorizon(budgetPlanId, year);
  // Lookup the current row so we can match the same expense in other periods
  const monthIndex = (MONTHS as MonthKey[]).indexOf(month);
  const monthNumber = monthIndex >= 0 ? monthIndex + 1 : null;
  const matchRow = monthNumber
    ? await prisma.expense.findFirst({
        where: { id, budgetPlanId, year, month: monthNumber },
        select: { name: true, categoryId: true },
      })
    : null;

  await updateExpense(budgetPlanId, month, id, { name, amount, categoryId, dueDate, isAllocation }, year);
	await syncExistingExpenseDebt({ budgetPlanId, expenseId: id, fallbackMonthKey: month, year });

  // If a due date is provided, propagate it across months as:
  // - same day-of-month
  // - same relative month offset from the expense month
  // Example: editing JAN expense due 2026-02-24 => FEB expense due 2026-03-24.
  let dueDateDay: number | undefined;
  let dueDateMonthOffset: number | undefined;
  if (dueDate && monthNumber) {
    const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(dueDate);
    if (m) {
      const dueYear = Number(m[1]);
      const dueMonth = Number(m[2]);
      const day = Number(m[3]);
      if (
        Number.isFinite(dueYear) &&
        Number.isFinite(dueMonth) &&
        dueMonth >= 1 &&
        dueMonth <= 12 &&
        Number.isFinite(day)
      ) {
        dueDateDay = day;
        dueDateMonthOffset = (dueYear - year) * 12 + (dueMonth - monthNumber);
      }
    }
  }

  if (applyRemainingMonths && matchRow && monthNumber) {
    const monthsThisYear = remainingMonthsFrom(month);
    const years = applyFutureYears ? horizon.allowedYears.filter((y) => y >= year) : [year];
    for (const y of years) {
      const monthsForYear = y === year ? monthsThisYear : (MONTHS as MonthKey[]);
      await updateExpenseAcrossMonthsByName(
        budgetPlanId,
        { name: matchRow.name, categoryId: matchRow.categoryId },
				{
					name,
					amount,
					categoryId,
					isAllocation,
					// Keep same day-of-month, adjust month/year per target expense.
					dueDateDay,
					dueDateMonthOffset,
				},
        y,
        monthsForYear
      );
    }
  }

	revalidateBudgetPlanViews({ username, budgetPlanId });
}

export async function removeExpenseAction(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  year?: number,
	options?: {
		applyRemainingMonths?: boolean;
		applyFutureYears?: boolean;
	}
): Promise<void> {
  const { userId, username } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
  const y = year ?? new Date().getFullYear();

  // Ensure the expense exists for this period.
  const monthIndex = (MONTHS as MonthKey[]).indexOf(month);
  const monthNumber = monthIndex >= 0 ? monthIndex + 1 : null;
  if (!monthNumber) throw new Error("Invalid month");
  const existing = await prisma.expense.findFirst({
    where: { id, budgetPlanId, year: y, month: monthNumber },
    select: { id: true, name: true, categoryId: true },
  });
  if (!existing) throw new Error("Expense not found");

  const applyRemainingMonths = Boolean(options?.applyRemainingMonths);
  const applyFutureYears = Boolean(options?.applyFutureYears);

  const deleteExpenseIds: string[] = [];

  if (!applyRemainingMonths && !applyFutureYears) {
    deleteExpenseIds.push(id);
  } else {
    const monthsThisYear = remainingMonthsFrom(month);
    const monthKeysToNumbers = (keys: MonthKey[]) =>
      keys
        .map((m) => (MONTHS as MonthKey[]).indexOf(m) + 1)
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);

    const years = applyFutureYears
      ? (await requireYearWithinBudgetHorizon(budgetPlanId, y)).allowedYears.filter((yr) => yr >= y)
      : [y];

    for (const targetYear of years) {
      const monthsForYear = targetYear === y ? monthsThisYear : (MONTHS as MonthKey[]);
      const monthNumbersForYear = monthKeysToNumbers(monthsForYear);
      if (monthNumbersForYear.length === 0) continue;

      const matches = await prisma.expense.findMany({
        where: {
          budgetPlanId,
          year: targetYear,
          month: { in: monthNumbersForYear },
          name: { equals: existing.name, mode: "insensitive" },
          categoryId: existing.categoryId,
        },
        select: { id: true },
      });

      deleteExpenseIds.push(...matches.map((m) => m.id));
    }
  }

  const uniqueDeleteIds = Array.from(new Set(deleteExpenseIds));
  if (uniqueDeleteIds.length === 0) {
		revalidateBudgetPlanViews({ username, budgetPlanId });
    return;
  }

  // Clean up any debt derived from the deleted expense rows.
  await prisma.debt.deleteMany({
    where: {
      budgetPlanId,
      sourceType: "expense",
      sourceExpenseId: { in: uniqueDeleteIds },
    },
  });

  if (uniqueDeleteIds.length === 1 && uniqueDeleteIds[0] === id) {
    await removeExpense(budgetPlanId, month, id, y);
  } else {
    await prisma.expense.deleteMany({
      where: {
        budgetPlanId,
        id: { in: uniqueDeleteIds },
      },
    });
  }
	revalidateBudgetPlanViews({ username, budgetPlanId });
}

export async function applyExpensePaymentAction(
	budgetPlanId: string,
  month: MonthKey,
  expenseId: string,
  paymentAmount: number,
  year?: number
): Promise<{ success: boolean; error?: string }>
{
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return { success: false, error: "Payment amount must be greater than 0" };
  }

  const { userId, username } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

  const result = await applyExpensePayment(budgetPlanId, month, expenseId, paymentAmount, year);
  if (!result) return { success: false, error: "Expense not found" };
	await syncExistingExpenseDebt({ budgetPlanId, expenseId, fallbackMonthKey: month, year });
	revalidateBudgetPlanViews({ username, budgetPlanId });
  return { success: true };
}

export async function setExpensePaidAmountAction(
	budgetPlanId: string,
  month: MonthKey,
  expenseId: string,
  paidAmount: number,
  year?: number
): Promise<{ success: boolean; error?: string }>
{
  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    return { success: false, error: "Paid amount must be 0 or more" };
  }

  const { userId, username } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

  const result = await setExpensePaymentAmount(budgetPlanId, month, expenseId, paidAmount, year);
  if (!result) return { success: false, error: "Expense not found" };
	await syncExistingExpenseDebt({ budgetPlanId, expenseId, fallbackMonthKey: month, year });
	revalidateBudgetPlanViews({ username, budgetPlanId });
  return { success: true };
}
