import { prisma } from "@/lib/prisma";
import type { BudgetStrategy as PrismaBudgetStrategy } from "@prisma/client";

export type BudgetStrategy = "zeroBased" | "fiftyThirtyTwenty" | "payYourselfFirst";

export interface Settings {
  payDate: number;
  monthlyAllowance: number;
  savingsBalance: number;
  monthlySavingsContribution: number;
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
  const plan = await prisma.budgetPlan.findUnique({
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
    },
  });

  if (!plan) {
    throw new Error(`Budget plan ${budgetPlanId} not found`);
  }

  return {
    payDate: plan.payDate,
    monthlyAllowance: Number(plan.monthlyAllowance),
    savingsBalance: Number(plan.savingsBalance),
    monthlySavingsContribution: Number(plan.monthlySavingsContribution),
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

  await prisma.budgetPlan.update({
    where: { id: budgetPlanId },
    data: updateData,
  });
}
