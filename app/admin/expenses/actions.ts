"use server";

import { revalidatePath } from "next/cache";
import {
  addExpense,
  toggleExpensePaid,
  updateExpense,
  removeExpense,
  applyExpensePayment,
  setExpensePaymentAmount,
} from "@/lib/expenses/store";
import type { MonthKey } from "@/types";

function requireBudgetPlanId(formData: FormData): string {
  const raw = formData.get("budgetPlanId");
  const budgetPlanId = String(raw ?? "").trim();
  if (!budgetPlanId) throw new Error("Missing budgetPlanId");
  return budgetPlanId;
}

export async function addExpenseAction(formData: FormData): Promise<void> {
  const budgetPlanId = requireBudgetPlanId(formData);
  const month = String(formData.get("month")) as MonthKey;
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const categoryId = String(formData.get("categoryId") || "") || undefined;
  const paid = String(formData.get("paid") || "false") === "true";
  if (!name || !month) return;
  await addExpense(budgetPlanId, month, {
    name,
    amount,
    categoryId,
    paid,
    paidAmount: paid ? amount : 0,
  });

  revalidatePath("/");
  revalidatePath("/admin/expenses");
}

export async function togglePaidAction(budgetPlanId: string, month: MonthKey, id: string): Promise<void> {
  await toggleExpensePaid(budgetPlanId, month, id);
  revalidatePath("/");
  revalidatePath("/admin/expenses");
}

export async function updateExpenseAction(formData: FormData): Promise<void> {
  const budgetPlanId = requireBudgetPlanId(formData);
  const month = String(formData.get("month")) as MonthKey;
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const categoryRaw = formData.get("categoryId");
  const categoryString = categoryRaw == null ? undefined : String(categoryRaw);
  const categoryId = categoryString === undefined ? undefined : categoryString.trim() ? categoryString.trim() : null;
  if (!month || !id || !name) return;

  await updateExpense(budgetPlanId, month, id, { name, amount, categoryId });

  revalidatePath("/");
  revalidatePath("/admin/expenses");
}

export async function removeExpenseAction(budgetPlanId: string, month: MonthKey, id: string): Promise<void> {
  await removeExpense(budgetPlanId, month, id);
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

  const result = await applyExpensePayment(budgetPlanId, month, expenseId, paymentAmount);
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

  const result = await setExpensePaymentAmount(budgetPlanId, month, expenseId, paidAmount);
  if (!result) return { success: false, error: "Expense not found" };

  revalidatePath("/");
  revalidatePath("/admin/expenses");
  return { success: true };
}
