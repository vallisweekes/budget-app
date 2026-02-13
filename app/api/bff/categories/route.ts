import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

	const budgetPlanId = await resolveOwnedBudgetPlanId({
		userId,
		budgetPlanId: searchParams.get("budgetPlanId"),
	});
	if (!budgetPlanId) {
		return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
	}

	await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId });

  const categories = await prisma.category.findMany({
    where: { budgetPlanId },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    select: { id: true, name: true, icon: true, color: true, featured: true },
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const body = await request.json();
    const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: typeof body?.budgetPlanId === "string" ? body.budgetPlanId : null,
		});
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
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

