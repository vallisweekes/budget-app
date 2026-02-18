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

const settingsSelectWithoutEmergency = {
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

    const plan = await prisma.budgetPlan.findUnique({
      where: { id: budgetPlanId },
      select: settingsSelect as any,
    });

    if (!plan) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

    return NextResponse.json(plan);
  } catch (error) {
    const message = String((error as any)?.message ?? error);
    if (message.includes("Unknown field `monthlyEmergencyContribution`")) {
      try {
        const userId = await getSessionUserId();
        if (!userId) return unauthorized();

        const { searchParams } = new URL(req.url);
        const budgetPlanId = await resolveOwnedBudgetPlanId({
          userId,
          budgetPlanId: searchParams.get("budgetPlanId"),
        });
        if (!budgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

        const plan = await prisma.budgetPlan.findUnique({
          where: { id: budgetPlanId },
          select: settingsSelectWithoutEmergency as any,
        });
        if (!plan) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

        return NextResponse.json({
          ...plan,
          monthlyEmergencyContribution: 0,
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

    if (Object.keys(updateData).length === 0) return badRequest("No valid fields to update");

    try {
      const updated = await prisma.budgetPlan.update({
        where: { id: budgetPlanId },
        data: updateData,
        select: settingsSelect as any,
      });

      return NextResponse.json(updated);
    } catch (error) {
      const message = String((error as any)?.message ?? error);
      if (!message.includes("Unknown field `monthlyEmergencyContribution`")) throw error;

      // Dev-only safety: ignore emergency contribution when Prisma Client is stale.
      if ("monthlyEmergencyContribution" in updateData) {
        delete updateData.monthlyEmergencyContribution;
      }

      const updated = await prisma.budgetPlan.update({
        where: { id: budgetPlanId },
        data: updateData,
        select: settingsSelectWithoutEmergency as any,
      });

      return NextResponse.json({
        ...updated,
        monthlyEmergencyContribution: 0,
      });
    }
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
