"use server";

import { revalidatePath } from "next/cache";
import {
  addOrUpdateExpenseAcrossMonths,
  toggleExpensePaid,
  updateExpense,
  removeExpense,
  applyExpensePayment,
  setExpensePaymentAmount,
} from "@/lib/expenses/store";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";

function isTruthyFormValue(value: FormDataEntryValue | null): boolean {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

function toYear(value: FormDataEntryValue | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function defaultYears(): number[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, i) => y + i);
}

async function requireAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const sessionUsername = sessionUser?.username ?? sessionUser?.name;
  if (!sessionUser || !sessionUsername) throw new Error("Not authenticated");
  const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
  return { userId };
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

export async function addExpenseAction(formData: FormData): Promise<void> {
  const budgetPlanId = requireBudgetPlanId(formData);
  const month = String(formData.get("month")) as MonthKey;
  const year = toYear(formData.get("year")) ?? new Date().getFullYear();
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const categoryId = String(formData.get("categoryId") || "") || undefined;
  const paid = String(formData.get("paid") || "false") === "true";
  if (!name || !month) return;

  const distributeMonths = isTruthyFormValue(formData.get("distributeMonths"));
  const distributeYears = isTruthyFormValue(formData.get("distributeYears"));
  const targetMonths: MonthKey[] = distributeMonths ? (MONTHS as MonthKey[]) : [month];
  const targetYears: number[] = distributeYears ? defaultYears() : [year];
  const sharedId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const { userId } = await requireAuthenticatedUser();
  await requireOwnedBudgetPlan(budgetPlanId, userId);

  for (const y of targetYears) {
    await addOrUpdateExpenseAcrossMonths(budgetPlanId, y, targetMonths, {
      id: sharedId,
      name,
      amount,
      categoryId,
      paid,
      paidAmount: paid ? amount : 0,
    });
  }

  revalidatePath("/");
  revalidatePath("/admin/expenses");
}

export async function togglePaidAction(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  year?: number
): Promise<void> {
  await toggleExpensePaid(budgetPlanId, month, id, year);
  revalidatePath("/");
  revalidatePath("/admin/expenses");
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
  if (!month || !id || !name) return;

	await updateExpense(budgetPlanId, month, id, { name, amount, categoryId }, year);

  revalidatePath("/");
  revalidatePath("/admin/expenses");
}

export async function removeExpenseAction(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  year?: number
): Promise<void> {
  await removeExpense(budgetPlanId, month, id, year);
  revalidatePath("/");
  revalidatePath("/admin/expenses");
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

  const result = await applyExpensePayment(budgetPlanId, month, expenseId, paymentAmount, year);
  if (!result) return { success: false, error: "Expense not found" };

  revalidatePath("/");
  revalidatePath("/admin/expenses");
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

  const result = await setExpensePaymentAmount(budgetPlanId, month, expenseId, paidAmount, year);
  if (!result) return { success: false, error: "Expense not found" };

  revalidatePath("/");
  revalidatePath("/admin/expenses");
  return { success: true };
}
