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
import { getSettings, saveSettings } from "@/lib/settings/store";
import { upsertExpenseDebt } from "@/lib/debts/store";

function getExpensePaymentDelegate(): any | null {
  return (prisma as any)?.expensePayment ?? null;
}

function prismaExpensePaymentHasField(fieldName: string): boolean {
  try {
    const fields = (prisma as any)?._runtimeDataModel?.models?.ExpensePayment?.fields;
    if (!Array.isArray(fields)) return false;
    return fields.some((f: any) => f?.name === fieldName);
  } catch {
    return false;
  }
}

const EXPENSE_PAYMENT_HAS_DEBT_ID = prismaExpensePaymentHasField("debtId");

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

function monthsFromToInclusive(start: MonthKey, endMonthNum: number): MonthKey[] {
  const startIdx = (MONTHS as MonthKey[]).indexOf(start);
  if (startIdx < 0) return [start];
  const endIdx = Math.max(0, Math.min(11, Math.floor(endMonthNum) - 1));
  if (endIdx < startIdx) return [start];
  return (MONTHS as MonthKey[]).slice(startIdx, endIdx + 1);
}

type NormalizedExpensePaymentSource = "income" | "savings" | "extra_untracked" | "credit_card";

function normalizeExpensePaymentSource(raw: unknown): NormalizedExpensePaymentSource {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "savings") return "savings";
  if (v === "credit_card" || v === "credit card" || v === "card" || v === "cc") return "credit_card";
  if (v === "other") return "extra_untracked";
  return "income";
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
  const plan = await prisma.budgetPlan.findUnique({
    where: { id: budgetPlanId },
    select: { id: true, userId: true, kind: true, eventDate: true, payDate: true },
  });
  if (!plan || plan.userId !== userId) throw new Error("Budget plan not found");
  return plan;
}

async function backfillExpensePaymentAndAdjustBalances(args: {
  budgetPlanId: string;
  planKind: string;
  name: string;
  categoryId?: string;
  year: number;
  months: MonthKey[];
  paid: boolean;
  paymentSource: NormalizedExpensePaymentSource;
	cardDebtId?: string;
}) {
  if (!args.paid) return;

	const expensePayment = getExpensePaymentDelegate();
	if (!expensePayment) return;

  const now = new Date();
  for (const m of args.months) {
    const monthIndex = (MONTHS as MonthKey[]).indexOf(m);
    const monthNum = monthIndex >= 0 ? monthIndex + 1 : null;
    if (!monthNum) continue;

    const expense = await prisma.expense.findFirst({
      where: {
        budgetPlanId: args.budgetPlanId,
        year: args.year,
        month: monthNum,
        name: { equals: args.name, mode: "insensitive" },
        ...(args.categoryId ? { categoryId: args.categoryId } : {}),
      },
      select: { id: true, paidAmount: true },
    });
    if (!expense) continue;

    const paidAmount = Number((expense.paidAmount as any)?.toString?.() ?? expense.paidAmount ?? 0);
    if (!(paidAmount > 0)) continue;

    const paymentsAgg = await expensePayment.aggregate({
      where: { expenseId: expense.id },
      _sum: { amount: true },
    });
    const recorded = Number((paymentsAgg._sum.amount as any)?.toString?.() ?? paymentsAgg._sum.amount ?? 0);
    const delta = Math.max(0, paidAmount - recorded);
    if (!(delta > 0)) continue;

    if (args.paymentSource === "credit_card") {
      await recordExpensePaymentAndAdjustBalances({
        budgetPlanId: args.budgetPlanId,
        planKind: args.planKind,
        expenseId: expense.id,
        amount: delta,
        paymentSource: "credit_card",
        cardDebtId: args.cardDebtId,
      });
      continue;
    }

    await expensePayment.create({
      data: {
        expenseId: expense.id,
        amount: delta,
        source: args.paymentSource,
        paidAt: now,
      },
    });

    if (args.paymentSource === "savings") {
      const settings = await getSettings(args.budgetPlanId);
      const current = Number(settings.savingsBalance ?? 0);
      await saveSettings(args.budgetPlanId, { savingsBalance: Math.max(0, current - delta) });
    }
  }
}

async function resolveCreditCardDebtId(params: {
  budgetPlanId: string;
  requestedDebtId?: string | null;
}): Promise<string> {
  const requested = String(params.requestedDebtId ?? "").trim();

  if (requested) {
    const found = await prisma.debt.findFirst({
      where: { id: requested, budgetPlanId: params.budgetPlanId, sourceType: null },
      select: { id: true, type: true },
    });
    if (!found) throw new Error("Selected card not found.");
    if (found.type !== "credit_card" && (found.type as any) !== "store_card") {
      throw new Error("Selected card must be a credit card or store card");
    }
    return found.id;
  }

  const cardsAll = await prisma.debt.findMany({
    where: { budgetPlanId: params.budgetPlanId, sourceType: null },
    select: { id: true, type: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }],
  });
  const cards = cardsAll.filter((c) => c.type === "credit_card" || (c.type as any) === "store_card");
  if (cards.length === 0) {
    throw new Error("No card found. Add a credit/store card in Debts, then select it as the payment source.");
  }
  if (cards.length > 1) {
    throw new Error("Multiple cards found. Please choose which card you used.");
  }
  return cards[0]!.id;
}

async function applyCreditCardCharge(params: { budgetPlanId: string; debtId: string; amount: number }) {
  const delta = Number(params.amount);
  if (!Number.isFinite(delta) || delta <= 0) return;

  await prisma.$transaction(async (tx) => {
    const card = await tx.debt.findFirst({
      where: { id: params.debtId, budgetPlanId: params.budgetPlanId, sourceType: null },
      select: { id: true, type: true, currentBalance: true, initialBalance: true, paidAmount: true },
    });
    if (!card) throw new Error("Card not found.");
    if (card.type !== "credit_card" && (card.type as any) !== "store_card") {
      throw new Error("Selected card must be a credit card or store card");
    }

    const current = Number((card.currentBalance as any)?.toString?.() ?? card.currentBalance ?? 0);
    const initial = Number((card.initialBalance as any)?.toString?.() ?? card.initialBalance ?? 0);
    const paidAmount = Number((card.paidAmount as any)?.toString?.() ?? card.paidAmount ?? 0);

    const nextCurrent = Math.max(0, current + delta);
    const nextInitial = Math.max(initial, nextCurrent);
    const nextPaidAmount = Math.min(Math.max(0, paidAmount), nextInitial);

    await tx.debt.update({
      where: { id: card.id },
      data: {
        currentBalance: String(nextCurrent),
        initialBalance: String(nextInitial),
        paidAmount: String(nextPaidAmount),
        paid: false,
      },
    });
  });
}

async function recordExpensePaymentAndAdjustBalances(args: {
  budgetPlanId: string;
  planKind: string;
  expenseId: string;
  amount: number;
  paymentSource: NormalizedExpensePaymentSource;
  cardDebtId?: string;
  debtId?: string;
  month?: MonthKey;
  year?: number;
}) {
  if (!Number.isFinite(args.amount) || args.amount <= 0) return;

  if (args.paymentSource === "credit_card") {
    const debtId = await resolveCreditCardDebtId({ budgetPlanId: args.budgetPlanId, requestedDebtId: args.cardDebtId });
    const expensePayment = getExpensePaymentDelegate();
    if (expensePayment) {
      await expensePayment.create({
        data: {
          expenseId: args.expenseId,
          amount: args.amount,
          source: args.paymentSource,
          ...(EXPENSE_PAYMENT_HAS_DEBT_ID ? { debtId } : {}),
          paidAt: new Date(),
        },
      });
    }
    await applyCreditCardCharge({ budgetPlanId: args.budgetPlanId, debtId, amount: args.amount });
    return;
  }

  const expensePayment = getExpensePaymentDelegate();
  if (!expensePayment) return;

  await expensePayment.create({
    data: {
      expenseId: args.expenseId,
      amount: args.amount,
      source: args.paymentSource,
      paidAt: new Date(),
    },
  });

  // If this payment represents a debt repayment, reduce that debt balance too.
  // This works even if the selected debt is itself still outstanding (e.g. credit card).
  const trimmedDebtId = String(args.debtId ?? "").trim();
  if (trimmedDebtId) {
    const targetDebt = await prisma.debt.findFirst({
      where: { id: trimmedDebtId, budgetPlanId: args.budgetPlanId },
      select: { id: true, sourceType: true },
    });
    if (!targetDebt) throw new Error("Selected debt not found");
    if (targetDebt.sourceType === "expense") {
      throw new Error("Cannot reduce an expense-derived debt from an expense payment");
    }

    const monthNumber = args.month ? (MONTHS as MonthKey[]).indexOf(args.month) + 1 : null;
    const y = args.year ?? new Date().getFullYear();
    const monthKey =
      monthNumber && monthNumber >= 1 && monthNumber <= 12
        ? `${y}-${String(monthNumber).padStart(2, "0")}`
        : `${y}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    const debtSource = args.paymentSource === "income" ? "income" : "extra_funds";
    const { addPayment } = await import("@/lib/debts/store");
    await addPayment(args.budgetPlanId, targetDebt.id, args.amount, monthKey, debtSource);
  }

  if (args.paymentSource === "savings") {
    const settings = await getSettings(args.budgetPlanId);
    const current = Number(settings.savingsBalance ?? 0);
    await saveSettings(args.budgetPlanId, { savingsBalance: Math.max(0, current - args.amount) });
  }
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
  const requestedYear = toYear(formData.get("year")) ?? new Date().getFullYear();
	const name = String(formData.get("name") || "").trim();
	const amount = Number(formData.get("amount") || 0);
	const categoryId = String(formData.get("categoryId") || "") || undefined;
	const paid = String(formData.get("paid") || "false") === "true";
  let isAllocation = isTruthyFormField(formData, "isAllocation");
  const isDirectDebit = isTruthyFormField(formData, "isDirectDebit");
  const rawPaymentSource = formData.get("paymentSource");
  const rawCardDebtId = formData.get("cardDebtId");
  const cardDebtId = rawCardDebtId == null ? undefined : String(rawCardDebtId).trim() || undefined;

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
	const sharedId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const { userId, username } = await requireAuthenticatedUser();
  const plan = await requireOwnedBudgetPlan(budgetPlanId, userId);
  const planKind = String((plan as any).kind ?? "personal");
  const eventDate = (plan as any).eventDate as Date | null | undefined;

  const paymentSource = normalizeExpensePaymentSource(rawPaymentSource);

  const isEventPlan = planKind === "holiday" || planKind === "carnival";
  const eventYear = isEventPlan && eventDate ? eventDate.getFullYear() : null;
  const eventMonthNum = isEventPlan && eventDate ? eventDate.getMonth() + 1 : null;

  if (isEventPlan && eventYear != null && requestedYear > eventYear) {
    throw new Error("Year must be on or before the event year");
  }

  const { allowedYears } = await requireYearWithinBudgetHorizon(budgetPlanId, requestedYear);
  const yearsRange = distributeYears
    ? allowedYears.filter((y) => y >= requestedYear)
    : [requestedYear];
  const targetYears =
    isEventPlan && eventYear != null
      ? yearsRange.filter((y) => y <= eventYear)
      : yearsRange;

  for (const y of targetYears) {
    const monthsForYear: MonthKey[] = (() => {
      if (!distributeMonths) {
        // If distributing across years but not months, keep it in the same month each year.
        return [month];
      }

      const startMonthKey: MonthKey = y === requestedYear ? month : "JANUARY";
      const endMonth: number =
        isEventPlan && eventYear != null && eventMonthNum != null && y === eventYear ? eventMonthNum : 12;
      return monthsFromToInclusive(startMonthKey, endMonth);
    })();

    await addOrUpdateExpenseAcrossMonths(budgetPlanId, y, monthsForYear, {
      id: sharedId,
      name,
      amount,
      categoryId,
      paid,
      paidAmount: paid ? amount : 0,
      isAllocation,
      isDirectDebit,
    });

    await backfillExpensePaymentAndAdjustBalances({
      budgetPlanId,
      planKind,
      name,
      categoryId,
      year: y,
      months: monthsForYear,
      paid,
      paymentSource,
			cardDebtId,
    });
  }

  revalidateBudgetPlanViews({ username, budgetPlanId });
}

export async function togglePaidAction(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  year?: number,
  paymentSource?: string,
	cardDebtId?: string,
	debtId?: string
): Promise<void> {
	const { userId, username } = await requireAuthenticatedUser();
  const plan = await requireOwnedBudgetPlan(budgetPlanId, userId);
  const planKind = String((plan as any).kind ?? "personal");
  const source = normalizeExpensePaymentSource(paymentSource);

  const y = year ?? new Date().getFullYear();
  const existing = await prisma.expense.findFirst({
    where: { id, budgetPlanId, year: y, month: (MONTHS as MonthKey[]).indexOf(month) + 1 },
		select: { paid: true, amount: true, paidAmount: true },
  });

  await toggleExpensePaid(budgetPlanId, month, id, year);

  if (existing && !existing.paid) {
    const amount = Number((existing.amount as any)?.toString?.() ?? existing.amount ?? 0);
    const paidAmount = Number((existing.paidAmount as any)?.toString?.() ?? existing.paidAmount ?? 0);
    const delta = Math.max(0, amount - paidAmount);
    await recordExpensePaymentAndAdjustBalances({
      budgetPlanId,
      planKind,
      expenseId: id,
      amount: delta,
      paymentSource: source,
      cardDebtId,
      debtId,
      month,
      year: y,
    });
  }
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
  year?: number,
  paymentSource?: string,
	cardDebtId?: string,
	debtId?: string
): Promise<{ success: boolean; error?: string }>
{
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return { success: false, error: "Payment amount must be greater than 0" };
  }

  const { userId, username } = await requireAuthenticatedUser();
  const plan = await requireOwnedBudgetPlan(budgetPlanId, userId);
  const planKind = String((plan as any).kind ?? "personal");
  const source = normalizeExpensePaymentSource(paymentSource);

  const y = year ?? new Date().getFullYear();
  const before = await prisma.expense.findFirst({
    where: { id: expenseId, budgetPlanId, year: y, month: (MONTHS as MonthKey[]).indexOf(month) + 1 },
    select: { paidAmount: true },
  });
  const beforePaid = Number((before?.paidAmount as any)?.toString?.() ?? before?.paidAmount ?? 0);

  const result = await applyExpensePayment(budgetPlanId, month, expenseId, paymentAmount, year);
  if (!result) return { success: false, error: "Expense not found" };

  const afterPaid = Number(result.expense.paidAmount ?? 0);
  const delta = Math.max(0, afterPaid - beforePaid);
  await recordExpensePaymentAndAdjustBalances({
    budgetPlanId,
    planKind,
    expenseId,
    amount: delta,
    paymentSource: source,
		cardDebtId,
    debtId,
    month,
    year: y,
  });
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
