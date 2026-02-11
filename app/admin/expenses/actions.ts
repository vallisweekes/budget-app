"use server";

import { revalidatePath } from "next/cache";
import {
  addExpense,
  toggleExpensePaid,
  removeExpense,
  applyExpensePayment,
  setExpensePaymentAmount,
  getAllExpenses,
} from "@/lib/expenses/store";
import { MonthKey } from "@/lib/budget/engine";
import { upsertExpenseDebt } from "@/lib/debts/store";
import { getCategories } from "@/lib/categories/store";

export async function addExpenseAction(formData: FormData): Promise<void> {
  const month = String(formData.get("month")) as MonthKey;
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const categoryId = String(formData.get("categoryId") || "") || undefined;
  const paid = String(formData.get("paid") || "false") === "true";
  const year = Number(formData.get("year") || 0) || undefined;
  if (!name || !month) return;
  const created = await addExpense(month, { name, amount, categoryId, paid, paidAmount: paid ? amount : 0 });

  const categories = await getCategories();
  const category = created.categoryId ? categories.find((c) => c.id === created.categoryId) : undefined;
  const remaining = Math.max(0, created.amount - (created.paidAmount ?? 0));
  upsertExpenseDebt({
    expenseId: created.id,
    monthKey: month,
    year,
    categoryId: created.categoryId,
    categoryName: category?.name,
    expenseName: created.name,
    remainingAmount: remaining,
  });

  revalidatePath("/");
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/debts");
}

export async function togglePaidAction(month: MonthKey, id: string): Promise<void> {
  await toggleExpensePaid(month, id);
  // After toggling, ensure remainder is represented as a debt (or removed if fully paid)
  const expensesData = await getAllExpenses();
  const expense = expensesData[month]?.find((e) => e.id === id);
  if (expense) {
    const categories = await getCategories();
    const category = expense.categoryId ? categories.find((c) => c.id === expense.categoryId) : undefined;
    const remaining = Math.max(0, expense.amount - (expense.paidAmount ?? 0));
    upsertExpenseDebt({
      expenseId: expense.id,
      monthKey: month,
      categoryId: expense.categoryId,
      categoryName: category?.name,
      expenseName: expense.name,
      remainingAmount: remaining,
    });
  }
  revalidatePath("/");
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/debts");
}

export async function removeExpenseAction(month: MonthKey, id: string): Promise<void> {
  // Remove any linked debt for this expense
  upsertExpenseDebt({
    expenseId: id,
    monthKey: month,
    expenseName: "",
    remainingAmount: 0,
  });
  await removeExpense(month, id);
  revalidatePath("/");
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/debts");
}

export async function applyExpensePaymentAction(
  month: MonthKey,
  expenseId: string,
  paymentAmount: number,
  year?: number
): Promise<{ success: boolean; error?: string }>
{
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return { success: false, error: "Payment amount must be greater than 0" };
  }

  const result = await applyExpensePayment(month, expenseId, paymentAmount);
  if (!result) return { success: false, error: "Expense not found" };

  const categories = await getCategories();
  const category = result.expense.categoryId ? categories.find((c) => c.id === result.expense.categoryId) : undefined;

  upsertExpenseDebt({
    expenseId: result.expense.id,
    monthKey: month,
    year,
    categoryId: result.expense.categoryId,
    categoryName: category?.name,
    expenseName: result.expense.name,
    remainingAmount: result.remaining,
  });

  revalidatePath("/");
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/debts");
  return { success: true };
}

export async function setExpensePaidAmountAction(
  month: MonthKey,
  expenseId: string,
  paidAmount: number,
  year?: number
): Promise<{ success: boolean; error?: string }>
{
  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    return { success: false, error: "Paid amount must be 0 or more" };
  }

  const result = await setExpensePaymentAmount(month, expenseId, paidAmount);
  if (!result) return { success: false, error: "Expense not found" };

  const categories = await getCategories();
  const category = result.expense.categoryId ? categories.find((c) => c.id === result.expense.categoryId) : undefined;

  upsertExpenseDebt({
    expenseId: result.expense.id,
    monthKey: month,
    year,
    categoryId: result.expense.categoryId,
    categoryName: category?.name,
    expenseName: result.expense.name,
    remainingAmount: result.remaining,
  });

  revalidatePath("/");
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/debts");
  return { success: true };
}
