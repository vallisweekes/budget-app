"use server";

import { revalidatePath } from "next/cache";
import { addGoal, updateGoal, deleteGoal } from "./store";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";
import { getSettings } from "@/lib/settings/store";

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

async function requireGoalYearWithinBudgetHorizon(budgetPlanId: string, year: number) {
  const nowYear = new Date().getFullYear();
  const settings = await getSettings(budgetPlanId);
  const horizonYearsRaw = Number(settings.budgetHorizonYears ?? 10);
  const horizonYears = Number.isFinite(horizonYearsRaw) && horizonYearsRaw > 0 ? Math.floor(horizonYearsRaw) : 10;
  const minYear = nowYear;
  const maxYear = nowYear + horizonYears - 1;
  if (year < minYear || year > maxYear) {
    throw new Error(`Year ${year} is outside your budget horizon (${minYear}-${maxYear}).`);
  }
}

export async function createGoal(formData: FormData) {
  const budgetPlanId = String(formData.get("budgetPlanId") ?? "").trim();
  const title = formData.get("title") as string;
  const type = formData.get("type") as "yearly" | "long-term";
  const category = formData.get("category") as "debt" | "savings" | "emergency" | "investment" | "other";
  const targetAmount = formData.get("targetAmount") ? parseFloat(formData.get("targetAmount") as string) : undefined;
  const currentAmount = formData.get("currentAmount") ? parseFloat(formData.get("currentAmount") as string) : undefined;
  const targetYear = formData.get("targetYear") ? parseInt(formData.get("targetYear") as string, 10) : undefined;
  const description = formData.get("description") as string || undefined;

  if (!title || !type || !category) {
    throw new Error("Invalid input");
  }
  if (!budgetPlanId) {
    throw new Error("Missing budgetPlanId");
  }

	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

  if (targetYear !== undefined) {
    if (Number.isNaN(targetYear)) throw new Error("Invalid target year");
    await requireGoalYearWithinBudgetHorizon(budgetPlanId, targetYear);
  }

  await addGoal(budgetPlanId, {
    title,
    type,
    category,
    targetAmount,
    currentAmount,
    targetYear,
    description,
  });

  revalidatePath(`/admin/goals?plan=${encodeURIComponent(budgetPlanId)}`);
  revalidatePath("/");
}

export async function updateGoalAction(id: string, formData: FormData) {
  const budgetPlanId = String(formData.get("budgetPlanId") ?? "").trim();
  const title = formData.get("title") as string;
  const targetAmount = formData.get("targetAmount") ? parseFloat(formData.get("targetAmount") as string) : undefined;
  const currentAmount = formData.get("currentAmount") ? parseFloat(formData.get("currentAmount") as string) : undefined;
  const targetYearRaw = formData.get("targetYear");
  let targetYear: number | null | undefined;
  if (targetYearRaw === null) {
    targetYear = undefined;
  } else {
    const trimmed = String(targetYearRaw).trim();
    if (!trimmed) {
      targetYear = null;
    } else {
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isNaN(parsed)) throw new Error("Invalid target year");
      targetYear = parsed;
    }
  }
  const description = formData.get("description") as string || undefined;

  if (!title) {
    throw new Error("Invalid input");
  }
  if (!budgetPlanId) {
    throw new Error("Missing budgetPlanId");
  }

	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

  if (typeof targetYear === "number") {
    await requireGoalYearWithinBudgetHorizon(budgetPlanId, targetYear);
  }

  await updateGoal(budgetPlanId, id, {
    title,
    targetAmount,
    currentAmount,
    targetYear,
    description,
  });

  revalidatePath(`/admin/goals?plan=${encodeURIComponent(budgetPlanId)}`);
  revalidatePath("/");
}

export async function deleteGoalAction(budgetPlanId: string, id: string) {
  if (!budgetPlanId) {
    throw new Error("Missing budgetPlanId");
  }
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
  await deleteGoal(budgetPlanId, id);
  revalidatePath(`/admin/goals?plan=${encodeURIComponent(budgetPlanId)}`);
  revalidatePath("/");
}
