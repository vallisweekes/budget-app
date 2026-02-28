import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { suggestCategoryNameForExpense } from "@/lib/expenses/expenseCategorizer";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * POST /api/bff/expenses/suggest-category
 * Body:
 *   { expenseName: string; budgetPlanId?: string }
 *
 * Returns:
 *   { categoryId: string|null; categoryName: string|null }
 */
export async function POST(req: NextRequest) {
	const userId = await getSessionUserId(req);
	if (!userId) return unauthorized();

	let body: { expenseName?: unknown; budgetPlanId?: unknown };
	try {
		body = (await req.json()) as { expenseName?: unknown; budgetPlanId?: unknown };
	} catch {
		return badRequest("Invalid JSON body");
	}

	const expenseName = typeof body.expenseName === "string" ? body.expenseName.trim() : "";
	if (!expenseName) return badRequest("expenseName is required");

	const budgetPlanId = await resolveOwnedBudgetPlanId({
		userId,
		budgetPlanId: typeof body.budgetPlanId === "string" ? body.budgetPlanId : null,
	});
	if (!budgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

	const categories = await prisma.category.findMany({
		where: { budgetPlanId },
		select: { id: true, name: true },
		orderBy: [{ featured: "desc" }, { name: "asc" }],
	});

	const availableCategoryNames = categories.map((c) => String(c.name ?? "").trim()).filter(Boolean);
	if (!availableCategoryNames.length) {
		return NextResponse.json({ categoryId: null, categoryName: null });
	}

	const categoryName = await suggestCategoryNameForExpense({
		expenseName,
		availableCategories: availableCategoryNames,
		preferAi: true,
	});

	if (!categoryName) {
		return NextResponse.json({ categoryId: null, categoryName: null });
	}

	const match = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase()) ?? null;
	return NextResponse.json({ categoryId: match?.id ?? null, categoryName: match?.name ?? null });
}
