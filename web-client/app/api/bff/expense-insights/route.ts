import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getBudgetPlanMeta } from "@/lib/helpers/dashboard/getBudgetPlanMeta";
import { getDashboardExpenseInsights } from "@/lib/helpers/dashboard/getDashboardExpenseInsights";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/**
 * GET /api/bff/expense-insights?budgetPlanId=<optional>
 *
 * Returns computed expense insights:
 * - Previous month recap (paid/unpaid/partial breakdown)
 * - Upcoming payments with urgency levels
 * - Actionable tips
 */
export async function GET(req: NextRequest) {
	try {
		const userId = await getSessionUserId();
		if (!userId) return unauthorized();

		const { searchParams } = new URL(req.url);
		const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

		const now = new Date();
		const { payDate } = await getBudgetPlanMeta(budgetPlanId);

		const insights = await getDashboardExpenseInsights({
			budgetPlanId,
			payDate,
			now,
			userId,
		});

		return NextResponse.json({
			recap: insights.recap,
			upcoming: insights.upcoming,
			tips: insights.recapTips,
		});
	} catch (error) {
		console.error("Failed to compute expense insights:", error);
		return NextResponse.json(
			{ error: "Failed to compute expense insights" },
			{ status: 500 }
		);
	}
}
