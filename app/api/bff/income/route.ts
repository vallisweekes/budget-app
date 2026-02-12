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
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const budgetPlanId = await resolveBudgetPlanId(searchParams.get("budgetPlanId"));

    if (!budgetPlanId) {
      return NextResponse.json(
        { error: "No budget plan found. Create a budget plan first." },
        { status: 400 }
      );
    }

    const where: any = { budgetPlanId };
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const income = await prisma.income.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(income);
  } catch (error) {
    console.error("Failed to fetch income:", error);
    return NextResponse.json(
      { error: "Failed to fetch income" },
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
    const income = await prisma.income.create({
      data: {
        name: body.name,
        amount: body.amount,
        month: body.month,
        year: body.year,
        budgetPlanId,
      },
    });

    return NextResponse.json(income, { status: 201 });
  } catch (error) {
    console.error("Failed to create income:", error);
    return NextResponse.json(
      { error: "Failed to create income" },
      { status: 500 }
    );
  }
}
