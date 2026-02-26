import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getZeroBasedSummary, isMonthKey } from "@/lib/budget/zero-based";
import { MONTHS } from "@/lib/constants/time";
import { monthNumberToKey } from "@/lib/helpers/monthKey";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * GET /api/bff/budget-summary?budgetPlanId=<optional>&month=<monthKey>&year=<year>
 *
 * Returns the zero-based budget summary for a given month.
 * Includes: incomeTotal, expenseTotal, debtPaymentsTotal, spendingTotal,
 *           planned allocations (allowance, savings, emergency, investments),
 *           and the unallocated remainder.
 */
export async function GET(req: NextRequest) {
	try {
		const userId = await getSessionUserId(req);
		if (!userId) return unauthorized();

		const { searchParams } = new URL(req.url);
		const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

		// Resolve month - accept "feb", "february", "2", or month key like "feb"
		let month = searchParams.get("month") ?? "";
		const yearParam = searchParams.get("year");
		const year = yearParam ? Number(yearParam) : undefined;

		// If month is a number (1-12), convert to month key
		const monthNum = Number(month);
		if (Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12) {
			month = monthNumberToKey(monthNum);
		}

		// Default to current month if not provided
		if (!month) {
			const now = new Date();
			month = MONTHS[now.getMonth()];
		}

		if (!isMonthKey(month)) {
			return badRequest(`Invalid month: "${month}". Use a month key like "jan", "feb", etc.`);
		}

		const summary = await getZeroBasedSummary(budgetPlanId, month, year ? { year } : undefined);

		return NextResponse.json(summary);
	} catch (error) {
		console.error("Failed to compute budget summary:", error);
		return NextResponse.json(
			{ error: "Failed to compute budget summary" },
			{ status: 500 }
		);
	}
}
