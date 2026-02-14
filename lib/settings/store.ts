import { prisma } from "@/lib/prisma";
import type { BudgetStrategy as PrismaBudgetStrategy } from "@prisma/client";

export type BudgetStrategy = "zeroBased" | "fiftyThirtyTwenty" | "payYourselfFirst";

export interface Settings {
  payDate: number;
  monthlyAllowance: number;
  savingsBalance: number;
  monthlySavingsContribution: number;
  monthlyEmergencyContribution: number;
  monthlyInvestmentContribution: number;
  budgetStrategy: BudgetStrategy;
  country: string;
  language: string;
  currency: string;
}

/**
 * Get settings for a specific budget plan from the database
 */
export async function getSettings(budgetPlanId: string): Promise<Settings> {
  let plan: any = null;

  try {
    plan = await prisma.budgetPlan.findUnique({
      where: { id: budgetPlanId },
      select: {
        payDate: true,
        monthlyAllowance: true,
        savingsBalance: true,
        monthlySavingsContribution: true,
        monthlyEmergencyContribution: true,
        monthlyInvestmentContribution: true,
        budgetStrategy: true,
        country: true,
        language: true,
        currency: true,
      } as any,
    });
  } catch (error) {
    const message = String((error as any)?.message ?? error);
    if (!message.includes("Unknown field `monthlyEmergencyContribution`")) throw error;

    // Dev-only safety: Turbopack can cache an older Prisma Client after schema changes.
    plan = await prisma.budgetPlan.findUnique({
      where: { id: budgetPlanId },
      select: {
        payDate: true,
        monthlyAllowance: true,
        savingsBalance: true,
        monthlySavingsContribution: true,
        monthlyInvestmentContribution: true,
        budgetStrategy: true,
        country: true,
        language: true,
        currency: true,
      } as any,
    });
  }

  if (!plan) {
    throw new Error(`Budget plan ${budgetPlanId} not found`);
  }

  return {
    payDate: plan.payDate,
    monthlyAllowance: Number(plan.monthlyAllowance),
    savingsBalance: Number(plan.savingsBalance),
    monthlySavingsContribution: Number(plan.monthlySavingsContribution),
    monthlyEmergencyContribution: Number((plan as any).monthlyEmergencyContribution ?? 0),
    monthlyInvestmentContribution: Number(plan.monthlyInvestmentContribution),
    budgetStrategy: plan.budgetStrategy as BudgetStrategy,
    country: plan.country,
    language: plan.language,
    currency: plan.currency,
  };
}

/**
 * Save settings for a specific budget plan to the database
 */
export async function saveSettings(budgetPlanId: string, settings: Partial<Settings>): Promise<void> {
  const updateData: any = {};

  if (settings.payDate !== undefined) {
    updateData.payDate = Math.max(1, Math.min(31, settings.payDate));
  }
  if (settings.monthlyAllowance !== undefined) {
    updateData.monthlyAllowance = settings.monthlyAllowance;
  }
  if (settings.savingsBalance !== undefined) {
    updateData.savingsBalance = settings.savingsBalance;
  }
  if (settings.monthlySavingsContribution !== undefined) {
    updateData.monthlySavingsContribution = settings.monthlySavingsContribution;
  }
  if (settings.monthlyEmergencyContribution !== undefined) {
    updateData.monthlyEmergencyContribution = settings.monthlyEmergencyContribution;
  }
  if (settings.monthlyInvestmentContribution !== undefined) {
    updateData.monthlyInvestmentContribution = settings.monthlyInvestmentContribution;
  }
  if (settings.budgetStrategy !== undefined) {
    updateData.budgetStrategy = settings.budgetStrategy;
  }
  if (settings.country !== undefined) {
    updateData.country = settings.country;
  }
  if (settings.language !== undefined) {
    updateData.language = settings.language;
  }
  if (settings.currency !== undefined) {
    updateData.currency = settings.currency;
  }

  try {
    await prisma.budgetPlan.update({
      where: { id: budgetPlanId },
      data: updateData,
    });
  } catch (error) {
    const message = String((error as any)?.message ?? error);
    if (!message.includes("Unknown field `monthlyEmergencyContribution`")) throw error;

    // Dev-only safety: retry without emergency contribution if Prisma Client is stale.
    if ("monthlyEmergencyContribution" in updateData) {
      delete updateData.monthlyEmergencyContribution;
    }
    await prisma.budgetPlan.update({
      where: { id: budgetPlanId },
      data: updateData,
    });
  }
}
