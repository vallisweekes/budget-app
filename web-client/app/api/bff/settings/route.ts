import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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
    const asNumber = Number((value as any)?.toString?.() ?? value);
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
    const asNumber = Number((value as any)?.toString?.() ?? value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  } catch {
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
    const asNumber = Number((value as any)?.toString?.() ?? value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  } catch {
    return 0;
  }
}

async function setInvestmentBalanceFallback(budgetPlanId: string, investmentBalance: number): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "BudgetPlan"
      SET "investmentBalance" = ${investmentBalance}
      WHERE id = ${budgetPlanId}
    `;
  } catch {
    // Column may not exist in older DBs.
  }
}

async function setIncomeDefaultsFallback(
  budgetPlanId: string,
  values: { fullYear?: boolean; horizon?: boolean },
): Promise<void> {
  try {
    if (typeof values.fullYear === "boolean" && typeof values.horizon === "boolean") {
      await prisma.$executeRaw`
        UPDATE "BudgetPlan"
        SET
          "incomeDistributeFullYearDefault" = ${values.fullYear},
          "incomeDistributeHorizonDefault" = ${values.horizon}
        WHERE id = ${budgetPlanId}
      `;
      return;
    }

    if (typeof values.fullYear === "boolean") {
      await prisma.$executeRaw`
        UPDATE "BudgetPlan"
        SET "incomeDistributeFullYearDefault" = ${values.fullYear}
        WHERE id = ${budgetPlanId}
      `;
    }

    if (typeof values.horizon === "boolean") {
      await prisma.$executeRaw`
        UPDATE "BudgetPlan"
        SET "incomeDistributeHorizonDefault" = ${values.horizon}
        WHERE id = ${budgetPlanId}
      `;
    }
  } catch {
    // Column may not exist in older DBs.
  }
}

function normalizeHomepageGoalIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return [];

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
    if (unique.length >= 2) break;
  }
  return unique;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(req.url);
    const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});
    if (!budgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

    const [plan, userRow] = await Promise.all([
      prisma.budgetPlan.findUnique({
        where: { id: budgetPlanId },
        select: settingsSelect as any,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
      }),
    ]);

    if (!plan) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

    const emergencyBalance = await getEmergencyBalanceFallback(budgetPlanId);
    const investmentBalance = await getInvestmentBalanceFallback(budgetPlanId);
    const budgetHorizonYears = Number((plan as any).budgetHorizonYears);
    const incomeDefaultsFromPlan = {
      fullYear: typeof (plan as any).incomeDistributeFullYearDefault === "boolean" ? (plan as any).incomeDistributeFullYearDefault : undefined,
      horizon: typeof (plan as any).incomeDistributeHorizonDefault === "boolean" ? (plan as any).incomeDistributeHorizonDefault : undefined,
    };
    const incomeDefaultsFallback = await getIncomeDefaultsFallback(budgetPlanId);
    const accountCreatedAt = userRow?.createdAt?.toISOString() ?? null;
    return NextResponse.json({
      ...plan,
      emergencyBalance,
      investmentBalance,
      budgetHorizonYears:
        Number.isFinite(budgetHorizonYears) && budgetHorizonYears > 0
          ? Math.floor(budgetHorizonYears)
          : await getBudgetHorizonYearsFallback(budgetPlanId),
      incomeDistributeFullYearDefault: incomeDefaultsFromPlan.fullYear ?? incomeDefaultsFallback.fullYear,
      incomeDistributeHorizonDefault: incomeDefaultsFromPlan.horizon ?? incomeDefaultsFallback.horizon,
      accountCreatedAt,
    });
  } catch (error) {
    const message = String((error as any)?.message ?? error);
    const unknownMonthlyEmergency = message.includes("Unknown field `monthlyEmergencyContribution`");
		if (unknownMonthlyEmergency) {
      try {
        const userId = await getSessionUserId();
        if (!userId) return unauthorized();

        const { searchParams } = new URL(req.url);
        const budgetPlanId = await resolveOwnedBudgetPlanId({
          userId,
          budgetPlanId: searchParams.get("budgetPlanId"),
        });
        if (!budgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

        const [plan, userRow2] = await Promise.all([
          prisma.budgetPlan.findUnique({
            where: { id: budgetPlanId },
            select: (unknownMonthlyEmergency ? settingsSelectLegacy : settingsSelectWithoutMonthlyEmergency) as any,
          }),
          prisma.user.findUnique({
            where: { id: userId! },
            select: { createdAt: true },
          }),
        ]);
        if (!plan) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
        const emergencyBalance = await getEmergencyBalanceFallback(budgetPlanId);
        const investmentBalance = await getInvestmentBalanceFallback(budgetPlanId);
        const budgetHorizonYearsFallback = await getBudgetHorizonYearsFallback(budgetPlanId);
        const incomeDefaultsFallback = await getIncomeDefaultsFallback(budgetPlanId);
        const accountCreatedAt2 = userRow2?.createdAt?.toISOString() ?? null;

        return NextResponse.json({
          ...plan,
				monthlyEmergencyContribution: unknownMonthlyEmergency ? 0 : (plan as any).monthlyEmergencyContribution,
				emergencyBalance,
				investmentBalance,
          budgetHorizonYears: Number((plan as any).budgetHorizonYears || 0) > 0 ? Number((plan as any).budgetHorizonYears) : budgetHorizonYearsFallback,
          incomeDistributeFullYearDefault:
            typeof (plan as any).incomeDistributeFullYearDefault === "boolean"
              ? (plan as any).incomeDistributeFullYearDefault
              : incomeDefaultsFallback.fullYear,
          incomeDistributeHorizonDefault:
            typeof (plan as any).incomeDistributeHorizonDefault === "boolean"
              ? (plan as any).incomeDistributeHorizonDefault
              : incomeDefaultsFallback.horizon,
          accountCreatedAt: accountCreatedAt2,
        });
      } catch (fallbackError) {
        console.error("Failed to fetch settings (fallback):", fallbackError);
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
      }
    }

    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(req.url);
    const raw = (await req.json().catch(() => null)) as unknown;
    if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body");

    const body = raw as Record<string, unknown>;
    const requestedBudgetPlanId =
      typeof body.budgetPlanId === "string" ? body.budgetPlanId : searchParams.get("budgetPlanId");
    if (!requestedBudgetPlanId || !requestedBudgetPlanId.trim()) return badRequest("budgetPlanId is required");

    const budgetPlanId = await resolveOwnedBudgetPlanId({
      userId,
      budgetPlanId: requestedBudgetPlanId,
    });
    if (!budgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (typeof body.payDate === "number") updateData.payDate = body.payDate;
    if (typeof body.monthlyAllowance !== "undefined") updateData.monthlyAllowance = body.monthlyAllowance;
    if (typeof body.savingsBalance !== "undefined") updateData.savingsBalance = body.savingsBalance;
    const wantsEmergencyBalance = typeof body.emergencyBalance !== "undefined";
    const emergencyBalance = wantsEmergencyBalance ? Number(body.emergencyBalance) : 0;
    const wantsInvestmentBalance = typeof body.investmentBalance !== "undefined";
    const investmentBalance = wantsInvestmentBalance ? Number(body.investmentBalance) : 0;
    if (typeof body.monthlySavingsContribution !== "undefined") {
      updateData.monthlySavingsContribution = body.monthlySavingsContribution;
    }
      if (typeof body.monthlyEmergencyContribution !== "undefined") {
        updateData.monthlyEmergencyContribution = body.monthlyEmergencyContribution;
      }
    if (typeof body.monthlyInvestmentContribution !== "undefined") {
      updateData.monthlyInvestmentContribution = body.monthlyInvestmentContribution;
    }
    if (typeof body.budgetStrategy === "string") updateData.budgetStrategy = body.budgetStrategy;
		if (typeof body.budgetHorizonYears === "number" && Number.isFinite(body.budgetHorizonYears)) {
			const safe = Math.max(1, Math.floor(body.budgetHorizonYears));
			updateData.budgetHorizonYears = safe;
		}
		if (typeof body.country === "string") updateData.country = body.country;
		if (typeof body.language === "string") updateData.language = body.language;
		if (typeof body.currency === "string") updateData.currency = body.currency;
    const wantsIncomeDistributeFullYearDefault = typeof body.incomeDistributeFullYearDefault === "boolean";
    const wantsIncomeDistributeHorizonDefault = typeof body.incomeDistributeHorizonDefault === "boolean";
    if (wantsIncomeDistributeFullYearDefault) {
      updateData.incomeDistributeFullYearDefault = body.incomeDistributeFullYearDefault;
    }
    if (wantsIncomeDistributeHorizonDefault) {
      updateData.incomeDistributeHorizonDefault = body.incomeDistributeHorizonDefault;
    }

    const homepageGoalIds = normalizeHomepageGoalIds((body as any).homepageGoalIds);
    if (homepageGoalIds !== null) {
      if (homepageGoalIds.length === 0) {
        updateData.homepageGoalIds = [];
      } else {
        const owned = await prisma.goal.findMany({
          where: {
            budgetPlanId,
            id: { in: homepageGoalIds },
          },
          select: { id: true },
        });
          const allowedSet = new Set(owned.map((g) => g.id));
				updateData.homepageGoalIds = homepageGoalIds.filter((id) => allowedSet.has(id));
      }
    }

      if (Object.keys(updateData).length === 0 && !wantsEmergencyBalance) {
        if (!wantsInvestmentBalance) return badRequest("No valid fields to update");
      }

      if (Object.keys(updateData).length === 0 && (wantsEmergencyBalance || wantsInvestmentBalance)) {
        if (Number.isFinite(emergencyBalance)) {
          await setEmergencyBalanceFallback(budgetPlanId, emergencyBalance);
        }
        if (wantsInvestmentBalance && Number.isFinite(investmentBalance)) {
          await setInvestmentBalanceFallback(budgetPlanId, investmentBalance);
        }
        if (wantsIncomeDistributeFullYearDefault || wantsIncomeDistributeHorizonDefault) {
          await setIncomeDefaultsFallback(budgetPlanId, {
            fullYear: wantsIncomeDistributeFullYearDefault ? Boolean(body.incomeDistributeFullYearDefault) : undefined,
            horizon: wantsIncomeDistributeHorizonDefault ? Boolean(body.incomeDistributeHorizonDefault) : undefined,
          });
        }
        const plan = await prisma.budgetPlan.findUnique({
          where: { id: budgetPlanId },
          select: settingsSelect as any,
        });
        if (!plan) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
        const nextEmergencyBalance = await getEmergencyBalanceFallback(budgetPlanId);
        const nextInvestmentBalance = await getInvestmentBalanceFallback(budgetPlanId);
        const nextIncomeDefaults = await getIncomeDefaultsFallback(budgetPlanId);
        return NextResponse.json({
          ...plan,
          emergencyBalance: nextEmergencyBalance,
          investmentBalance: nextInvestmentBalance,
          budgetHorizonYears: Number((plan as any).budgetHorizonYears || 0) > 0 ? Number((plan as any).budgetHorizonYears) : await getBudgetHorizonYearsFallback(budgetPlanId),
          incomeDistributeFullYearDefault:
            typeof (plan as any).incomeDistributeFullYearDefault === "boolean"
              ? (plan as any).incomeDistributeFullYearDefault
              : nextIncomeDefaults.fullYear,
          incomeDistributeHorizonDefault:
            typeof (plan as any).incomeDistributeHorizonDefault === "boolean"
              ? (plan as any).incomeDistributeHorizonDefault
              : nextIncomeDefaults.horizon,
        });
      }

    try {
      const updated = await prisma.budgetPlan.update({
        where: { id: budgetPlanId },
        data: updateData,
        select: settingsSelect as any,
      });
      if (wantsEmergencyBalance && Number.isFinite(emergencyBalance)) {
        await setEmergencyBalanceFallback(budgetPlanId, emergencyBalance);
      }
      if (wantsIncomeDistributeFullYearDefault || wantsIncomeDistributeHorizonDefault) {
        await setIncomeDefaultsFallback(budgetPlanId, {
          fullYear: wantsIncomeDistributeFullYearDefault ? Boolean(body.incomeDistributeFullYearDefault) : undefined,
          horizon: wantsIncomeDistributeHorizonDefault ? Boolean(body.incomeDistributeHorizonDefault) : undefined,
        });
      }
      const nextEmergencyBalance = await getEmergencyBalanceFallback(budgetPlanId);
      if (wantsInvestmentBalance && Number.isFinite(investmentBalance)) {
        await setInvestmentBalanceFallback(budgetPlanId, investmentBalance);
      }
      const nextInvestmentBalance = await getInvestmentBalanceFallback(budgetPlanId);
      const nextIncomeDefaults = await getIncomeDefaultsFallback(budgetPlanId);
      return NextResponse.json({
        ...updated,
        emergencyBalance: nextEmergencyBalance,
        investmentBalance: nextInvestmentBalance,
        budgetHorizonYears: Number((updated as any).budgetHorizonYears || 0) > 0 ? Number((updated as any).budgetHorizonYears) : await getBudgetHorizonYearsFallback(budgetPlanId),
        incomeDistributeFullYearDefault:
          typeof (updated as any).incomeDistributeFullYearDefault === "boolean"
            ? (updated as any).incomeDistributeFullYearDefault
            : nextIncomeDefaults.fullYear,
        incomeDistributeHorizonDefault:
          typeof (updated as any).incomeDistributeHorizonDefault === "boolean"
            ? (updated as any).incomeDistributeHorizonDefault
            : nextIncomeDefaults.horizon,
      });
    } catch (error) {
      const message = String((error as any)?.message ?? error);
			const unknownMonthlyEmergency =
				message.includes("Unknown field `monthlyEmergencyContribution`") ||
				message.includes("Unknown argument `monthlyEmergencyContribution`");
      const unknownIncomeDefaults =
        message.includes("Unknown field `incomeDistributeFullYearDefault`") ||
        message.includes("Unknown argument `incomeDistributeFullYearDefault`") ||
        message.includes("Unknown field `incomeDistributeHorizonDefault`") ||
        message.includes("Unknown argument `incomeDistributeHorizonDefault`");
      if (!unknownMonthlyEmergency && !unknownIncomeDefaults) throw error;

			// Dev-only safety: ignore unknown fields when Prisma Client is stale.
			if (unknownMonthlyEmergency && "monthlyEmergencyContribution" in updateData) {
				delete updateData.monthlyEmergencyContribution;
			}
      if ("incomeDistributeFullYearDefault" in updateData) {
        delete updateData.incomeDistributeFullYearDefault;
      }
      if ("incomeDistributeHorizonDefault" in updateData) {
        delete updateData.incomeDistributeHorizonDefault;
      }
      if (wantsEmergencyBalance && Number.isFinite(emergencyBalance)) {
        await setEmergencyBalanceFallback(budgetPlanId, emergencyBalance);
      }
      if (wantsInvestmentBalance && Number.isFinite(investmentBalance)) {
        await setInvestmentBalanceFallback(budgetPlanId, investmentBalance);
      }

			const updated = await prisma.budgetPlan.update({
				where: { id: budgetPlanId },
				data: updateData,
        select: (unknownMonthlyEmergency ? settingsSelectLegacy : settingsSelectWithoutMonthlyEmergency) as any,
			});
      const nextEmergencyBalance = await getEmergencyBalanceFallback(budgetPlanId);
      const nextInvestmentBalance = await getInvestmentBalanceFallback(budgetPlanId);
      return NextResponse.json({
        ...updated,
        monthlyEmergencyContribution: unknownMonthlyEmergency ? 0 : (updated as any).monthlyEmergencyContribution,
      emergencyBalance: nextEmergencyBalance,
      investmentBalance: nextInvestmentBalance,
      });
    }
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
