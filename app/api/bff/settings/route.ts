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
  monthlyInvestmentContribution: true,
  budgetStrategy: true,
} as const;

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
      select: settingsSelect,
    });

    if (!plan) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

    return NextResponse.json(plan);
  } catch (error) {
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
    if (typeof body.monthlyInvestmentContribution !== "undefined") {
      updateData.monthlyInvestmentContribution = body.monthlyInvestmentContribution;
    }
    if (typeof body.budgetStrategy === "string") updateData.budgetStrategy = body.budgetStrategy;

    if (Object.keys(updateData).length === 0) return badRequest("No valid fields to update");

    const updated = await prisma.budgetPlan.update({
      where: { id: budgetPlanId },
      data: updateData,
      select: settingsSelect,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
