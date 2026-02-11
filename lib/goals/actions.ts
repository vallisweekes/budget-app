"use server";

import { revalidatePath } from "next/cache";
import { addGoal, updateGoal, deleteGoal } from "./store";

export async function createGoal(formData: FormData) {
  const title = formData.get("title") as string;
  const type = formData.get("type") as "yearly" | "long-term";
  const category = formData.get("category") as "debt" | "savings" | "emergency" | "investment" | "other";
  const targetAmount = formData.get("targetAmount") ? parseFloat(formData.get("targetAmount") as string) : undefined;
  const currentAmount = formData.get("currentAmount") ? parseFloat(formData.get("currentAmount") as string) : undefined;
  const targetYear = formData.get("targetYear") ? parseInt(formData.get("targetYear") as string) : undefined;
  const description = formData.get("description") as string || undefined;

  if (!title || !type || !category) {
    throw new Error("Invalid input");
  }

  addGoal({
    title,
    type,
    category,
    targetAmount,
    currentAmount,
    targetYear,
    description,
  });

  revalidatePath("/admin/goals");
  revalidatePath("/");
}

export async function updateGoalAction(id: string, formData: FormData) {
  const title = formData.get("title") as string;
  const targetAmount = formData.get("targetAmount") ? parseFloat(formData.get("targetAmount") as string) : undefined;
  const currentAmount = formData.get("currentAmount") ? parseFloat(formData.get("currentAmount") as string) : undefined;
  const description = formData.get("description") as string || undefined;

  if (!title) {
    throw new Error("Invalid input");
  }

  updateGoal(id, {
    title,
    targetAmount,
    currentAmount,
    description,
  });

  revalidatePath("/admin/goals");
  revalidatePath("/");
}

export async function deleteGoalAction(id: string) {
  deleteGoal(id);
  revalidatePath("/admin/goals");
  revalidatePath("/");
}
