import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

/**
 * GET /api/bff/credit-cards?budgetPlanId=<optional>
 *
 * Returns credit card and store card debts for the current user's budget plan.
 * Used by mobile to populate the "Source of Funds – Credit Card" picker.
 */
export async function GET(req: NextRequest) {
	const userId = await getSessionUserId();
	if (!userId) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const { searchParams } = new URL(req.url);
	const budgetPlanId = await resolveOwnedBudgetPlanId({
		userId,
		budgetPlanId: searchParams.get("budgetPlanId"),
	});
	if (!budgetPlanId) {
		return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
	}

	const cards = await prisma.debt.findMany({
		where: {
			budgetPlanId,
			sourceType: null, // exclude expense-derived debts
			type: { in: ["credit_card", "store_card"] },
		},
		select: { id: true, name: true, type: true, creditLimit: true, currentBalance: true },
		orderBy: { createdAt: "asc" },
	});

	return NextResponse.json(
		cards.map((c) => ({
			id: c.id,
			name: c.name,
			type: c.type,
			creditLimit: c.creditLimit != null ? String(c.creditLimit) : null,
			currentBalance: c.currentBalance != null ? String(c.currentBalance) : null,
		}))
	);
}
