import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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
  const { searchParams } = new URL(request.url);
  const budgetPlanId = await resolveBudgetPlanId(searchParams.get("budgetPlanId"));
  if (!budgetPlanId) {
    return NextResponse.json(
      { error: "No budget plan found. Create a budget plan first." },
      { status: 400 }
    );
  }

  const categories = await prisma.category.findMany({
    where: { budgetPlanId },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    select: { id: true, name: true, icon: true, color: true, featured: true },
  });

  return NextResponse.json(categories);
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

    const category = await prisma.category.create({
      data: {
        name: body.name,
        icon: body.icon || null,
        color: body.color || null,
        featured: body.featured || false,
        budgetPlanId,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Failed to create category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}

