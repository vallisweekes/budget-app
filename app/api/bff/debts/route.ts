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

    const debts = await prisma.debt.findMany({
      where: { budgetPlanId },
      include: {
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(debts);
  } catch (error) {
    console.error("Failed to fetch debts:", error);
    return NextResponse.json(
      { error: "Failed to fetch debts" },
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
    const debt = await prisma.debt.create({
      data: {
        name: body.name,
        type: body.type,
        initialBalance: body.initialBalance,
        currentBalance: body.currentBalance || body.initialBalance,
        amount: body.amount,
        paid: body.paid || false,
        paidAmount: body.paidAmount || 0,
        monthlyMinimum: body.monthlyMinimum || null,
        interestRate: body.interestRate || null,
        sourceType: body.sourceType || null,
        sourceExpenseId: body.sourceExpenseId || null,
        sourceMonthKey: body.sourceMonthKey || null,
        sourceCategoryId: body.sourceCategoryId || null,
        sourceCategoryName: body.sourceCategoryName || null,
        sourceExpenseName: body.sourceExpenseName || null,
        budgetPlanId,
      },
    });

    return NextResponse.json(debt, { status: 201 });
  } catch (error) {
    console.error("Failed to create debt:", error);
    return NextResponse.json(
      { error: "Failed to create debt" },
      { status: 500 }
    );
  }
}
