import { prisma } from "@/lib/prisma";
import type { BudgetStrategy as PrismaBudgetStrategy } from "@prisma/client";

export type BudgetStrategy = "zeroBased" | "fiftyThirtyTwenty" | "payYourselfFirst";

export interface Settings {
  payDate: number;
  monthlyAllowance: number;
  savingsBalance: number;
  emergencyBalance: number;
  monthlySavingsContribution: number;
  monthlyEmergencyContribution: number;
  monthlyInvestmentContribution: number;
  budgetStrategy: BudgetStrategy;
  budgetHorizonYears: number;
  homepageGoalIds: string[];
  country: string;
  language: string;
  currency: string;
}

function prismaBudgetPlanHasField(fieldName: string): boolean {
  try {
    const fields = (prisma as any)?._runtimeDataModel?.models?.BudgetPlan?.fields;
    if (!Array.isArray(fields)) return false;
    return fields.some((f: any) => f?.name === fieldName);
  } catch {
    return false;
  }
}

async function getEmergencyBalanceFallback(budgetPlanId: string): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ emergencyBalance: unknown }>>`
      SELECT "emergencyBalance" as "emergencyBalance"
      FROM "BudgetPlan"
      WHERE id = ${budgetPlanId}
      LIMIT 1
    `;
    const value = rows?.[0]?.emergencyBalance;
    if (value == null) return 0;
    const asNumber = Number((value as any)?.toString?.() ?? value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  } catch {
    // Column may not exist in older DBs.
    return 0;
  }
}

async function setEmergencyBalanceFallback(budgetPlanId: string, emergencyBalance: number): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "BudgetPlan"
      SET "emergencyBalance" = ${emergencyBalance}
      WHERE id = ${budgetPlanId}
    `;
  } catch {
    // Column may not exist in older DBs.
  }
}

async function getBudgetHorizonYearsFallback(budgetPlanId: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ budgetHorizonYears: number | null }>>`
      SELECT "budgetHorizonYears" as "budgetHorizonYears"
      FROM "BudgetPlan"
      WHERE id = ${budgetPlanId}
      LIMIT 1
    `;
    const value = rows?.[0]?.budgetHorizonYears;
    return value == null ? null : Number(value);
  } catch {
    return null;
  }
}

/**
 * Get settings for a specific budget plan from the database
 */
export async function getSettings(budgetPlanId: string): Promise<Settings> {
  let plan: any = null;

  try {
    const select: any = {
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
    };

		if (prismaBudgetPlanHasField("emergencyBalance")) {
			select.emergencyBalance = true;
		}

		// Turbopack/dev can sometimes run with a stale Prisma Client after schema changes.
		// Only include newer fields when the runtime client supports them.
		if (prismaBudgetPlanHasField("budgetHorizonYears")) {
			select.budgetHorizonYears = true;
		}
    if (prismaBudgetPlanHasField("homepageGoalIds")) {
      select.homepageGoalIds = true;
    }

    plan = await prisma.budgetPlan.findUnique({
      where: { id: budgetPlanId },
			select,
    });
  } catch (error) {
    const message = String((error as any)?.message ?? error);

		const unknownEmergency = message.includes("Unknown field `monthlyEmergencyContribution`");
		const unknownEmergencyBalance = message.includes("Unknown field `emergencyBalance`");
		const unknownHorizon = message.includes("Unknown field `budgetHorizonYears`");
    const unknownHomepage = message.includes("Unknown field `homepageGoalIds`");
		if (!unknownEmergency && !unknownEmergencyBalance && !unknownHorizon && !unknownHomepage) throw error;

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
    if (!unknownEmergencyBalance) select.emergencyBalance = true;
    if (!unknownHorizon) select.budgetHorizonYears = true;
    if (!unknownHomepage) select.homepageGoalIds = true;

		plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select,
		} as any);
  }

  if (!plan) {
    throw new Error(`Budget plan ${budgetPlanId} not found`);
  }

  const horizonFromPlan = Number((plan as any).budgetHorizonYears);
  const budgetHorizonYears = Number.isFinite(horizonFromPlan) && horizonFromPlan > 0
		? horizonFromPlan
		: (await getBudgetHorizonYearsFallback(budgetPlanId)) ?? 10;

  const emergencyBalance = typeof (plan as any).emergencyBalance !== "undefined"
    ? Number((plan as any).emergencyBalance ?? 0)
    : await getEmergencyBalanceFallback(budgetPlanId);

  return {
    payDate: plan.payDate,
    monthlyAllowance: Number(plan.monthlyAllowance),
    savingsBalance: Number(plan.savingsBalance),
		emergencyBalance,
    monthlySavingsContribution: Number(plan.monthlySavingsContribution),
    monthlyEmergencyContribution: Number((plan as any).monthlyEmergencyContribution ?? 0),
    monthlyInvestmentContribution: Number(plan.monthlyInvestmentContribution),
    budgetStrategy: plan.budgetStrategy as BudgetStrategy,
    budgetHorizonYears: Number(budgetHorizonYears),
    homepageGoalIds: Array.isArray((plan as any).homepageGoalIds)
			? ((plan as any).homepageGoalIds as unknown[]).filter((v): v is string => typeof v === "string")
			: [],
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
  const wantsEmergencyBalance = settings.emergencyBalance !== undefined;
  const emergencyBalanceValue = wantsEmergencyBalance ? Number(settings.emergencyBalance) : null;

  if (settings.payDate !== undefined) {
    updateData.payDate = Math.max(1, Math.min(31, settings.payDate));
  }
  if (settings.monthlyAllowance !== undefined) {
    updateData.monthlyAllowance = settings.monthlyAllowance;
  }
  if (settings.savingsBalance !== undefined) {
    updateData.savingsBalance = settings.savingsBalance;
  }
  if (wantsEmergencyBalance && prismaBudgetPlanHasField("emergencyBalance")) {
    updateData.emergencyBalance = emergencyBalanceValue;
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
  if (settings.homepageGoalIds !== undefined) {
    updateData.homepageGoalIds = Array.isArray(settings.homepageGoalIds) ? settings.homepageGoalIds.slice(0, 2) : [];
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

  if (Object.keys(updateData).length === 0) {
    if (wantsEmergencyBalance) {
      await setEmergencyBalanceFallback(budgetPlanId, emergencyBalanceValue ?? 0);
    }
    return;
  }

  try {
    await prisma.budgetPlan.update({
      where: { id: budgetPlanId },
      data: updateData,
    });

		if (wantsEmergencyBalance && !prismaBudgetPlanHasField("emergencyBalance")) {
			await setEmergencyBalanceFallback(budgetPlanId, emergencyBalanceValue ?? 0);
		}
  } catch (error) {
    const message = String((error as any)?.message ?? error);

    const unknownEmergency =
      message.includes("Unknown field `monthlyEmergencyContribution`") ||
      message.includes("Unknown argument `monthlyEmergencyContribution`");
    const unknownHorizon =
      message.includes("Unknown field `budgetHorizonYears`") ||
      message.includes("Unknown argument `budgetHorizonYears`");
    const unknownEmergencyBalance =
      message.includes("Unknown field `emergencyBalance`") ||
      message.includes("Unknown argument `emergencyBalance`");
    const unknownHomepage =
			message.includes("Unknown field `homepageGoalIds`") ||
			message.includes("Unknown argument `homepageGoalIds`");
    if (!unknownEmergency && !unknownEmergencyBalance && !unknownHorizon && !unknownHomepage) throw error;

    // Dev-only safety: retry without unknown fields if Prisma Client is stale.
    if (unknownEmergency && "monthlyEmergencyContribution" in updateData) {
      delete updateData.monthlyEmergencyContribution;
    }
		if (unknownEmergencyBalance && "emergencyBalance" in updateData) {
			delete updateData.emergencyBalance;
		}
    if (unknownHorizon && "budgetHorizonYears" in updateData) {
      delete updateData.budgetHorizonYears;
    }
		if (unknownHomepage && "homepageGoalIds" in updateData) {
			delete updateData.homepageGoalIds;
		}

    await prisma.budgetPlan.update({
      where: { id: budgetPlanId },
      data: updateData,
    });

		if (wantsEmergencyBalance) {
			await setEmergencyBalanceFallback(budgetPlanId, emergencyBalanceValue ?? 0);
		}
  }
}
