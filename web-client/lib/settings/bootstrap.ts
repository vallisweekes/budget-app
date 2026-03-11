import { prisma } from "@/lib/prisma";
import { supportsOnboardingCadenceFields as detectOnboardingCadenceFields } from "@/lib/prisma/capabilities";
import { resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { normalizeBillFrequency, normalizePayFrequency } from "@/lib/payPeriods";

export type BootstrapSettingsPayload = {
  id: string;
  payDate: number | null;
  payFrequency: "monthly" | "every_2_weeks" | "weekly";
  billFrequency: "monthly" | "every_2_weeks";
  monthlyAllowance: unknown;
  savingsBalance: unknown;
  emergencyBalance: number;
  investmentBalance: number;
  monthlySavingsContribution: unknown;
  monthlyEmergencyContribution: unknown;
  monthlyInvestmentContribution: unknown;
  budgetStrategy: string | null;
  budgetHorizonYears: number;
  incomeDistributeFullYearDefault: boolean;
  incomeDistributeHorizonDefault: boolean;
  homepageGoalIds: string[];
  country: string | null;
  language: string | null;
  currency: string | null;
  accountCreatedAt: string | null;
  setupCompletedAt: string | null;
};

function latestDate(...dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
}

const settingsSelect = {
  id: true,
  payDate: true,
  monthlyAllowance: true,
  savingsBalance: true,
  monthlySavingsContribution: true,
  monthlyEmergencyContribution: true,
  monthlyInvestmentContribution: true,
  budgetStrategy: true,
  budgetHorizonYears: true,
  homepageGoalIds: true,
  country: true,
  language: true,
  currency: true,
} as const;

const settingsSelectWithoutMonthlyEmergency = {
  id: true,
  payDate: true,
  monthlyAllowance: true,
  savingsBalance: true,
  monthlySavingsContribution: true,
  monthlyInvestmentContribution: true,
  budgetStrategy: true,
  budgetHorizonYears: true,
  homepageGoalIds: true,
  country: true,
  language: true,
  currency: true,
} as const;

const settingsSelectLegacy = {
  id: true,
  payDate: true,
  monthlyAllowance: true,
  savingsBalance: true,
  monthlySavingsContribution: true,
  monthlyInvestmentContribution: true,
  budgetStrategy: true,
  budgetHorizonYears: true,
  homepageGoalIds: true,
  country: true,
  language: true,
  currency: true,
} as const;

async function getBudgetHorizonYearsFallback(budgetPlanId: string): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ budgetHorizonYears: unknown }>>`
      SELECT "budgetHorizonYears" as "budgetHorizonYears"
      FROM "BudgetPlan"
      WHERE id = ${budgetPlanId}
      LIMIT 1
    `;
    const value = rows?.[0]?.budgetHorizonYears;
    const asNumber = Number((value as { toString?: () => string } | null | undefined)?.toString?.() ?? value);
    return Number.isFinite(asNumber) && asNumber > 0 ? Math.floor(asNumber) : 10;
  } catch {
    return 10;
  }
}

async function getIncomeDefaultsFallback(budgetPlanId: string): Promise<{ fullYear: boolean; horizon: boolean }> {
  try {
    const rows = await prisma.$queryRaw<Array<{ fullYear: unknown; horizon: unknown }>>`
      SELECT
        "incomeDistributeFullYearDefault" as "fullYear",
        "incomeDistributeHorizonDefault" as "horizon"
      FROM "BudgetPlan"
      WHERE id = ${budgetPlanId}
      LIMIT 1
    `;
    const row = rows?.[0];
    return {
      fullYear: Boolean(row?.fullYear),
      horizon: Boolean(row?.horizon),
    };
  } catch {
    return { fullYear: false, horizon: false };
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
    const asNumber = Number((value as { toString?: () => string } | null | undefined)?.toString?.() ?? value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  } catch {
    return 0;
  }
}

async function getInvestmentBalanceFallback(budgetPlanId: string): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ investmentBalance: unknown }>>`
      SELECT "investmentBalance" as "investmentBalance"
      FROM "BudgetPlan"
      WHERE id = ${budgetPlanId}
      LIMIT 1
    `;
    const value = rows?.[0]?.investmentBalance;
    if (value == null) return 0;
    const asNumber = Number((value as { toString?: () => string } | null | undefined)?.toString?.() ?? value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  } catch {
    return 0;
  }
}

function isUnknownCadenceFieldError(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null | undefined)?.message ?? error);
  return (
    /Unknown field `payFrequency`/i.test(message) ||
    /Unknown field `billFrequency`/i.test(message) ||
    /Unknown arg(ument)? `payFrequency`/i.test(message) ||
    /Unknown arg(ument)? `billFrequency`/i.test(message) ||
    /data\.payFrequency/i.test(message) ||
    /data\.billFrequency/i.test(message)
  );
}

let supportsCadenceFields: boolean | null = null;

async function getCadenceForUser(userId: string): Promise<{
  payFrequency: "monthly" | "every_2_weeks" | "weekly";
  billFrequency: "monthly" | "every_2_weeks";
}> {
  if (supportsCadenceFields === false) {
    return {
      payFrequency: "monthly",
      billFrequency: "monthly",
    };
  }

  if (!(await detectOnboardingCadenceFields())) {
    supportsCadenceFields = false;
    return {
      payFrequency: "monthly",
      billFrequency: "monthly",
    };
  }

  try {
    const profile = await prisma.userOnboardingProfile.findUnique({
      where: { userId },
      select: { payFrequency: true, billFrequency: true },
    });
    supportsCadenceFields = true;
    return {
      payFrequency: normalizePayFrequency(profile?.payFrequency),
      billFrequency: normalizeBillFrequency(profile?.billFrequency),
    };
  } catch (error) {
    if (!isUnknownCadenceFieldError(error)) throw error;
    supportsCadenceFields = false;
    return {
      payFrequency: "monthly",
      billFrequency: "monthly",
    };
  }
}

type SelectedPlanRow = {
  id: string;
  payDate: number | null;
  monthlyAllowance: unknown;
  savingsBalance: unknown;
  monthlySavingsContribution: unknown;
  monthlyEmergencyContribution?: unknown;
  monthlyInvestmentContribution: unknown;
  budgetStrategy: string | null;
  budgetHorizonYears?: unknown;
  incomeDistributeFullYearDefault?: unknown;
  incomeDistributeHorizonDefault?: unknown;
  homepageGoalIds: string[];
  country: string | null;
  language: string | null;
  currency: string | null;
};

function buildSettingsPayload(params: {
  plan: SelectedPlanRow;
  emergencyBalance: number;
  investmentBalance: number;
  budgetHorizonYears: number;
  incomeDistributeFullYearDefault: boolean;
  incomeDistributeHorizonDefault: boolean;
  accountCreatedAt: string | null;
  setupCompletedAt: string | null;
  cadence: { payFrequency: "monthly" | "every_2_weeks" | "weekly"; billFrequency: "monthly" | "every_2_weeks" };
  monthlyEmergencyContribution: unknown;
}): BootstrapSettingsPayload {
  const {
    plan,
    emergencyBalance,
    investmentBalance,
    budgetHorizonYears,
    incomeDistributeFullYearDefault,
    incomeDistributeHorizonDefault,
    accountCreatedAt,
    setupCompletedAt,
    cadence,
    monthlyEmergencyContribution,
  } = params;

  return {
    ...plan,
    emergencyBalance,
    investmentBalance,
    budgetHorizonYears,
    incomeDistributeFullYearDefault,
    incomeDistributeHorizonDefault,
    accountCreatedAt,
    setupCompletedAt,
    payFrequency: cadence.payFrequency,
    billFrequency: cadence.billFrequency,
    monthlyEmergencyContribution,
  };
}

export async function getBootstrapSettingsForUser(params: {
  userId: string;
  budgetPlanId?: string | null;
}): Promise<BootstrapSettingsPayload | null> {
  const budgetPlanId = await resolveOwnedBudgetPlanId({
    userId: params.userId,
    budgetPlanId: params.budgetPlanId ?? null,
  });
  if (!budgetPlanId) return null;

  try {
    const [plan, userRow, profile] = await Promise.all([
      prisma.budgetPlan.findUnique({
        where: { id: budgetPlanId },
        select: settingsSelect as never,
      }) as Promise<SelectedPlanRow | null>,
      prisma.user.findUnique({
        where: { id: params.userId },
        select: { createdAt: true },
      }),
      prisma.userOnboardingProfile.findUnique({
        where: { userId: params.userId },
        select: { completedAt: true, updatedAt: true, status: true },
      }).catch(() => null),
    ]);

    if (!plan) return null;

    const emergencyBalance = await getEmergencyBalanceFallback(budgetPlanId);
    const investmentBalance = await getInvestmentBalanceFallback(budgetPlanId);
    const budgetHorizonYears = Number(plan.budgetHorizonYears);
    const incomeDefaultsFromPlan = {
      fullYear: typeof plan.incomeDistributeFullYearDefault === "boolean" ? plan.incomeDistributeFullYearDefault : undefined,
      horizon: typeof plan.incomeDistributeHorizonDefault === "boolean" ? plan.incomeDistributeHorizonDefault : undefined,
    };
    const incomeDefaultsFallback = await getIncomeDefaultsFallback(budgetPlanId);
    const accountCreatedAt = userRow?.createdAt?.toISOString() ?? null;
    const setupCompletedAt = latestDate(
      profile?.completedAt ?? null,
      profile?.status === "completed" ? profile?.updatedAt ?? null : null,
    )?.toISOString() ?? null;
    const cadence = await getCadenceForUser(params.userId);

    return buildSettingsPayload({
      plan,
      emergencyBalance,
      investmentBalance,
      budgetHorizonYears:
        Number.isFinite(budgetHorizonYears) && budgetHorizonYears > 0
          ? Math.floor(budgetHorizonYears)
          : await getBudgetHorizonYearsFallback(budgetPlanId),
      incomeDistributeFullYearDefault: incomeDefaultsFromPlan.fullYear ?? incomeDefaultsFallback.fullYear,
      incomeDistributeHorizonDefault: incomeDefaultsFromPlan.horizon ?? incomeDefaultsFallback.horizon,
      accountCreatedAt,
      setupCompletedAt,
      cadence,
      monthlyEmergencyContribution: plan.monthlyEmergencyContribution ?? 0,
    });
  } catch (error) {
    const message = String((error as { message?: unknown } | null | undefined)?.message ?? error);
    const unknownMonthlyEmergency = message.includes("Unknown field `monthlyEmergencyContribution`");
    if (!unknownMonthlyEmergency) throw error;

    const [plan, userRow, profile] = await Promise.all([
      prisma.budgetPlan.findUnique({
        where: { id: budgetPlanId },
        select: settingsSelectLegacy as never,
      }) as Promise<SelectedPlanRow | null>,
      prisma.user.findUnique({
        where: { id: params.userId },
        select: { createdAt: true },
      }),
      prisma.userOnboardingProfile.findUnique({
        where: { userId: params.userId },
        select: { completedAt: true, updatedAt: true, status: true },
      }).catch(() => null),
    ]);

    if (!plan) return null;

    const emergencyBalance = await getEmergencyBalanceFallback(budgetPlanId);
    const investmentBalance = await getInvestmentBalanceFallback(budgetPlanId);
    const budgetHorizonYearsFallback = await getBudgetHorizonYearsFallback(budgetPlanId);
    const incomeDefaultsFallback = await getIncomeDefaultsFallback(budgetPlanId);
    const accountCreatedAt = userRow?.createdAt?.toISOString() ?? null;
    const setupCompletedAt = latestDate(
      profile?.completedAt ?? null,
      profile?.status === "completed" ? profile?.updatedAt ?? null : null,
    )?.toISOString() ?? null;
    const cadence = await getCadenceForUser(params.userId);

    return buildSettingsPayload({
      plan,
      emergencyBalance,
      investmentBalance,
      budgetHorizonYears: Number(plan.budgetHorizonYears || 0) > 0 ? Number(plan.budgetHorizonYears) : budgetHorizonYearsFallback,
      incomeDistributeFullYearDefault:
        typeof plan.incomeDistributeFullYearDefault === "boolean"
          ? plan.incomeDistributeFullYearDefault
          : incomeDefaultsFallback.fullYear,
      incomeDistributeHorizonDefault:
        typeof plan.incomeDistributeHorizonDefault === "boolean"
          ? plan.incomeDistributeHorizonDefault
          : incomeDefaultsFallback.horizon,
      accountCreatedAt,
      setupCompletedAt,
      cadence,
      monthlyEmergencyContribution: 0,
    });
  }
}