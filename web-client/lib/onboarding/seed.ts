import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import { prisma } from "@/lib/prisma";

import type { SeedPeriod } from "./types";

export function getBudgetHorizonTargetYear(params: { planningYears: number; referenceDate: Date | null | undefined; fallbackYear: number }) {
  const safeYears = Math.max(1, Math.min(30, Math.trunc(params.planningYears)));
  const baseYear = params.referenceDate instanceof Date && !Number.isNaN(params.referenceDate.getTime())
    ? params.referenceDate.getUTCFullYear()
    : params.fallbackYear;
  return baseYear + safeYears - 1;
}

export function buildForwardSeedMonths(startDate: Date, planningYears: number): SeedPeriod[] {
  const safeYears = Math.max(1, Math.min(30, Math.trunc(planningYears)));
  return Array.from({ length: safeYears * 12 }, (_, offset) => {
    const absolute = startDate.getMonth() + offset;
    return { month: (absolute % 12) + 1, year: startDate.getFullYear() + Math.floor(absolute / 12) };
  });
}

export function buildForwardSeedPeriodsFromMonth(params: { startMonth: number; startYear: number; planningYears: number }): SeedPeriod[] {
  const safeYears = Math.max(1, Math.min(30, Math.trunc(params.planningYears)));
  const startMonth = Math.max(1, Math.min(12, Math.trunc(params.startMonth)));
  const startYear = Math.trunc(params.startYear);
  return Array.from({ length: safeYears * 12 }, (_, offset) => {
    const absolute = ((startYear * 12) + (startMonth - 1)) + offset;
    return { month: (absolute % 12) + 1, year: Math.floor(absolute / 12) };
  });
}

export async function ensurePersonalPlan(userId: string): Promise<{ id: string; createdAt: Date }> {
  const existing = await prisma.budgetPlan.findFirst({ where: { userId, kind: "personal" }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true } });
  if (existing) return existing;
  const created = await prisma.budgetPlan.create({ data: { userId, kind: "personal", name: "Personal" }, select: { id: true, createdAt: true } });
  await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: created.id });
  return created;
}