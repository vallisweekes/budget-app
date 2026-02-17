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
  budgetHorizonYears: number;
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
        budgetHorizonYears: true,
        country: true,
        language: true,
        currency: true,
      } as any,
    });
  } catch (error) {
    const message = String((error as any)?.message ?? error);

		const unknownEmergency = message.includes("Unknown field `monthlyEmergencyContribution`");
		const unknownHorizon = message.includes("Unknown field `budgetHorizonYears`");
		if (!unknownEmergency && !unknownHorizon) throw error;

		// Dev-only safety: Turbopack can cache an older Prisma Client after schema changes.
		// Retry with a select that excludes the unknown field(s).
		const select: any = {
			payDate: true,
			monthlyAllowance: true,
			savingsBalance: true,
			monthlySavingsContribution: true,
			monthlyInvestmentContribution: true,
			budgetStrategy: true,
			country: true,
			language: true,
			currency: true,
		};
		if (!unknownEmergency) select.monthlyEmergencyContribution = true;
		if (!unknownHorizon) select.budgetHorizonYears = true;

		plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select,
		} as any);
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
    budgetHorizonYears: Number((plan as any).budgetHorizonYears ?? 10),
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
  if (settings.budgetHorizonYears !== undefined) {
    updateData.budgetHorizonYears = settings.budgetHorizonYears;
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

    const unknownEmergency =
      message.includes("Unknown field `monthlyEmergencyContribution`") ||
      message.includes("Unknown argument `monthlyEmergencyContribution`");
    const unknownHorizon =
      message.includes("Unknown field `budgetHorizonYears`") ||
      message.includes("Unknown argument `budgetHorizonYears`");
    if (!unknownEmergency && !unknownHorizon) throw error;

    // Dev-only safety: retry without unknown fields if Prisma Client is stale.
    if (unknownEmergency && "monthlyEmergencyContribution" in updateData) {
      delete updateData.monthlyEmergencyContribution;
    }
    if (unknownHorizon && "budgetHorizonYears" in updateData) {
      delete updateData.budgetHorizonYears;
    }

    await prisma.budgetPlan.update({
      where: { id: budgetPlanId },
      data: updateData,
    });
  }
}
