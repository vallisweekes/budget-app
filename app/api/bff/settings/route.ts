import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function resolveBudgetPlanId(maybeBudgetPlanId: string | null): Promise<string | null> {
  const budgetPlanId = maybeBudgetPlanId?.trim();
  if (budgetPlanId) return budgetPlanId;

  const plan = await prisma.budgetPlan.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return plan?.id ?? null;
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
    const { searchParams } = new URL(req.url);
    const budgetPlanId = await resolveBudgetPlanId(searchParams.get("budgetPlanId"));
    if (!budgetPlanId) return badRequest("No budget plan found. Create a budget plan first.");

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
    const { searchParams } = new URL(req.url);
    const raw = (await req.json().catch(() => null)) as unknown;
    if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body");

    const body = raw as Record<string, unknown>;
    const budgetPlanId = await resolveBudgetPlanId(
      typeof body.budgetPlanId === "string" ? body.budgetPlanId : searchParams.get("budgetPlanId")
    );
    if (!budgetPlanId) return badRequest("budgetPlanId is required");

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
