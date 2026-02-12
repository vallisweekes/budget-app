"use server";

import { getCategories, saveCategories, CategoryConfig } from "@/lib/categories/store";
import { getAllExpenses } from "@/lib/expenses/store";
import { listBudgetDataPlanIds } from "@/lib/storage/listBudgetDataPlanIds";
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
  // Categories are global; check usage across all budget data directories.
  const planIds = await listBudgetDataPlanIds();
  const hasExpenses = await (async () => {
    for (const planId of planIds) {
      const expenses = await getAllExpenses(planId);
      const used = Object.values(expenses).some((monthExpenses) =>
        monthExpenses.some((expense) => expense.categoryId === id)
      );
      if (used) return true;
    }
    return false;
  })();

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
