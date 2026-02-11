"use server";

import { revalidatePath } from "next/cache";
import { addExpense, toggleExpensePaid, removeExpense } from "../../../lib/expenses/store";
import { MonthKey } from "../../../lib/budget/engine";

export async function addExpenseAction(formData: FormData): Promise<void> {
  const month = String(formData.get("month")) as MonthKey;
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const categoryId = String(formData.get("categoryId") || "") || undefined;
  const paid = String(formData.get("paid") || "false") === "true";
  if (!name || !month) return;
  await addExpense(month, { name, amount, categoryId, paid });
  revalidatePath("/");
  revalidatePath("/admin/expenses");
}

export async function togglePaidAction(month: MonthKey, id: string): Promise<void> {
  await toggleExpensePaid(month, id);
  revalidatePath("/");
  revalidatePath("/admin/expenses");
}

export async function removeExpenseAction(month: MonthKey, id: string): Promise<void> {
  await removeExpense(month, id);
  revalidatePath("/");
  revalidatePath("/admin/expenses");
}
