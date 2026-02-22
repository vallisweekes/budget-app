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
  homepageGoalIds: true,
  country: true,
  language: true,
  currency: true,
} as const;

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
    const accountCreatedAt = userRow?.createdAt?.toISOString() ?? null;
    return NextResponse.json({ ...plan, emergencyBalance, investmentBalance, accountCreatedAt });
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
        const accountCreatedAt2 = userRow2?.createdAt?.toISOString() ?? null;

        return NextResponse.json({
          ...plan,
				monthlyEmergencyContribution: unknownMonthlyEmergency ? 0 : (plan as any).monthlyEmergencyContribution,
				emergencyBalance,
				investmentBalance,
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
		if (typeof body.country === "string") updateData.country = body.country;
		if (typeof body.language === "string") updateData.language = body.language;
		if (typeof body.currency === "string") updateData.currency = body.currency;

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
        const plan = await prisma.budgetPlan.findUnique({
          where: { id: budgetPlanId },
          select: settingsSelect as any,
        });
        if (!plan) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
        const nextEmergencyBalance = await getEmergencyBalanceFallback(budgetPlanId);
        const nextInvestmentBalance = await getInvestmentBalanceFallback(budgetPlanId);
        return NextResponse.json({ ...plan, emergencyBalance: nextEmergencyBalance, investmentBalance: nextInvestmentBalance });
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
      const nextEmergencyBalance = await getEmergencyBalanceFallback(budgetPlanId);
      if (wantsInvestmentBalance && Number.isFinite(investmentBalance)) {
        await setInvestmentBalanceFallback(budgetPlanId, investmentBalance);
      }
      const nextInvestmentBalance = await getInvestmentBalanceFallback(budgetPlanId);
      return NextResponse.json({ ...updated, emergencyBalance: nextEmergencyBalance, investmentBalance: nextInvestmentBalance });
    } catch (error) {
      const message = String((error as any)?.message ?? error);
			const unknownMonthlyEmergency =
				message.includes("Unknown field `monthlyEmergencyContribution`") ||
				message.includes("Unknown argument `monthlyEmergencyContribution`");
      if (!unknownMonthlyEmergency) throw error;

			// Dev-only safety: ignore unknown fields when Prisma Client is stale.
			if (unknownMonthlyEmergency && "monthlyEmergencyContribution" in updateData) {
				delete updateData.monthlyEmergencyContribution;
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
