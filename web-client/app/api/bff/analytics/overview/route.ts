import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getAllIncome, resolveIncomeYear } from "@/lib/income/store";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(msg: string) {
	return NextResponse.json({ error: msg }, { status: 400 });
}

function toN(v: string | null): number | null {
	if (v == null) return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function toNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}
	if (typeof (value as { toString?: () => string })?.toString === "function") {
		const n = Number((value as { toString: () => string }).toString());
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

/**
 * GET /api/bff/analytics/overview?year=<optional>&budgetPlanId=<optional>
 *
 * Returns a 12-month series suitable for charting income vs expenses.
 * This avoids clients making 12x calls to /api/bff/expenses/summary.
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

		const yearParam = toN(searchParams.get("year"));
		if (yearParam != null && yearParam < 1900) return badRequest("Invalid year");
		const year = yearParam ?? (await resolveIncomeYear(budgetPlanId));

		const [incomeByMonth, expenseGrouped] = await Promise.all([
			getAllIncome(budgetPlanId, year),
			prisma.expense.groupBy({
				by: ["month"],
				where: { budgetPlanId, year },
				_sum: { amount: true },
				_count: { _all: true },
				orderBy: { month: "asc" },
			}),
		]);

		const expenseTotalsByMonthIndex = new Map<number, { totalAmount: number; totalCount: number }>();
		for (const g of expenseGrouped) {
			expenseTotalsByMonthIndex.set(g.month, {
				totalAmount: toNumber(g._sum.amount),
				totalCount: g._count._all,
			});
		}

		const months = MONTHS.map((monthKey: MonthKey, index: number) => {
			const monthIndex = index + 1;
			const incomeItems = incomeByMonth[monthKey] ?? [];
			const incomeTotal = incomeItems.reduce((sum, item) => sum + item.amount, 0);
			const exp = expenseTotalsByMonthIndex.get(monthIndex);
			const expenseTotal = exp?.totalAmount ?? 0;
			const expenseCount = exp?.totalCount ?? 0;

			return {
				monthKey,
				monthIndex,
				incomeTotal: parseFloat(incomeTotal.toFixed(2)),
				expenseTotal: parseFloat(expenseTotal.toFixed(2)),
				expenseCount,
			};
		});

		const incomeGrandTotal = months.reduce((sum, m) => sum + m.incomeTotal, 0);
		const expenseGrandTotal = months.reduce((sum, m) => sum + m.expenseTotal, 0);

		return NextResponse.json({
			year,
			budgetPlanId,
			months,
			incomeGrandTotal: parseFloat(incomeGrandTotal.toFixed(2)),
			expenseGrandTotal: parseFloat(expenseGrandTotal.toFixed(2)),
		});
	} catch (error) {
		console.error("[bff/analytics/overview] Error:", error);
		return NextResponse.json(
			{ error: "Failed to load analytics overview" },
			{ status: 500 },
		);
	}
}
