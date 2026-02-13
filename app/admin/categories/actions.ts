"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { resolveUserId, getDefaultBudgetPlanForUser } from "@/lib/budgetPlans";
import { revalidatePath } from "next/cache";
import { getAllExpenses } from "@/lib/expenses/store";

export async function addCategory(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const username = sessionUser?.username ?? sessionUser?.name;
  if (!sessionUser || !username) return;
  
  const userId = await resolveUserId({ userId: sessionUser.id, username });
  const defaultPlan = await getDefaultBudgetPlanForUser({ userId, username });
  if (!defaultPlan) return;

  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const icon = String(formData.get("icon") || "").trim();
  const featured = String(formData.get("featured") || "false") === "true";

  await prisma.category.create({
    data: {
      name,
      icon: icon || null,
      featured,
      budgetPlanId: defaultPlan.id,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/expenses");
}

export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const username = sessionUser?.username ?? sessionUser?.name;
  if (!sessionUser || !username) {
    return { success: false, error: "Unauthorized" };
  }
  
  const userId = await resolveUserId({ userId: sessionUser.id, username });
  
  // Check if category belongs to user's plan
  const category = await prisma.category.findUnique({
    where: { id },
    include: { budgetPlan: true },
  });

  if (!category || category.budgetPlan.userId !== userId) {
    return { success: false, error: "Category not found or unauthorized" };
  }

  // Check if category has expenses (in file system for now)
  const expenses = await getAllExpenses(category.budgetPlanId);
  const hasExpenses = Object.values(expenses).some((monthExpenses) =>
    monthExpenses.some((expense) => expense.categoryId === id)
  );

  if (hasExpenses) {
    return { 
      success: false, 
      error: "Cannot delete category with existing expenses. Please reassign or delete the expenses first." 
    };
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/admin/expenses");
  
  return { success: true };
}
