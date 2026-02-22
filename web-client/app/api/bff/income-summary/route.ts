import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getAllIncome, resolveIncomeYear } from "@/lib/income/store";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/**
 * GET /api/bff/income-summary?year=<optional>&budgetPlanId=<optional>
 *
 * Returns a 12-month income grid with totals, matching the web admin income page.
 * Each month entry contains the list of income sources and a computed total.
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

		// Resolve the year — use query param or fall back to the plan's default year
		const yearParam = searchParams.get("year");
		const year =
			yearParam && Number.isFinite(Number(yearParam))
				? Number(yearParam)
				: await resolveIncomeYear(budgetPlanId);

		// getAllIncome returns Record<MonthKey, IncomeItem[]>
		const incomeByMonth = await getAllIncome(budgetPlanId, year);

		// Build structured response
		const months = MONTHS.map((monthKey: MonthKey, index: number) => {
			const items = incomeByMonth[monthKey] ?? [];
			const total = items.reduce((sum, item) => sum + item.amount, 0);
			return {
				monthKey,
				monthIndex: index + 1, // 1-12
				items: items.map((item) => ({
					id: item.id,
					name: item.name,
					amount: item.amount,
				})),
				total,
			};
		});

		const grandTotal = months.reduce((sum, m) => sum + m.total, 0);
		const monthsWithIncome = months.filter((m) => m.items.length > 0).length;

		return NextResponse.json({
			year,
			budgetPlanId,
			months,
			grandTotal,
			monthsWithIncome,
		});
	} catch (error) {
		console.error("[bff/income-summary] Error:", error);
		return NextResponse.json(
			{ error: "Failed to load income summary" },
			{ status: 500 },
		);
	}
}
