"use server";

import { getCategories, saveCategories, CategoryConfig } from "../../../lib/categories/store";
import { getAllExpenses } from "../../../lib/expenses/store";
import crypto from "node:crypto";

export async function addCategory(formData: FormData): Promise<void> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const icon = String(formData.get("icon") || "").trim();
  const featured = String(formData.get("featured") || "false") === "true";

  const list = await getCategories();
  const id = crypto.randomUUID();
  const entry: CategoryConfig = { id, name, icon: icon || undefined, featured };
  await saveCategories([entry, ...list]);
}

export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
  // Check if category is used in any expenses
  const expenses = await getAllExpenses();
  const hasExpenses = Object.values(expenses).some(monthExpenses => 
    monthExpenses.some(expense => expense.categoryId === id)
  );

  if (hasExpenses) {
    return { 
      success: false, 
      error: "Cannot delete category with existing expenses. Please reassign or delete the expenses first." 
    };
  }

  const list = await getCategories();
  const next = list.filter((c) => c.id !== id);
  await saveCategories(next);
  
  return { success: true };
}
