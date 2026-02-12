import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function resolveBudgetPlanId(maybeBudgetPlanId: string | null): Promise<string | null> {
  const budgetPlanId = maybeBudgetPlanId?.trim();
  if (budgetPlanId) return budgetPlanId;

  const plan = await prisma.budgetPlan.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return plan?.id ?? null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const budgetPlanId = await resolveBudgetPlanId(searchParams.get("budgetPlanId"));
    if (!budgetPlanId) {
      return NextResponse.json(
        { error: "No budget plan found. Create a budget plan first." },
        { status: 400 }
      );
    }

    const goals = await prisma.goal.findMany({
      where: { budgetPlanId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(goals);
  } catch (error) {
    console.error("Failed to fetch goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const budgetPlanId = await resolveBudgetPlanId(
      typeof body?.budgetPlanId === "string" ? body.budgetPlanId : null
    );
    if (!budgetPlanId) {
      return NextResponse.json(
        { error: "budgetPlanId is required" },
        { status: 400 }
      );
    }
    const goal = await prisma.goal.create({
      data: {
        title: body.title,
        type: body.type,
        category: body.category,
        description: body.description || null,
        targetAmount: body.targetAmount || null,
        currentAmount: body.currentAmount || 0,
        targetYear: body.targetYear || null,
        budgetPlanId,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("Failed to create goal:", error);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}
