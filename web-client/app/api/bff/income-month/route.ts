import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { resolveUserPayPeriodContext } from "@/lib/api/payPeriodContext";
import { getIncomeMonthAnalysis } from "@/lib/helpers/finance/getIncomeMonthAnalysis";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/**
 * GET /api/bff/income-month?month=2&year=2026&budgetPlanId=<optional>
 *
 * Returns all computed data for a single income month view —
 * the SAME calculations as web-client/app/admin/income/IncomeMonthPage.tsx.
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

		const { month, year, payFrequency } = await resolveUserPayPeriodContext({
			userId,
			budgetPlanId,
			requestedMonth: searchParams.get("month"),
			requestedYear: searchParams.get("year"),
		});

		const prevMonth = month === 1 ? 12 : month - 1;
		const prevYear = month === 1 ? year - 1 : year;

		const [analysis, prevAnalysis] = await Promise.all([
			getIncomeMonthAnalysis({ budgetPlanId, year, month, payFrequency }),
			getIncomeMonthAnalysis({ budgetPlanId, year: prevYear, month: prevMonth, payFrequency }),
		]);

		const grossIncome = analysis.grossIncome;
		const incomeSacrifice = analysis.incomeSacrifice;
		const moneyLeftAfterPlan = analysis.moneyLeftAfterPlan;
		const previousMoneyLeftAfterPlan = prevAnalysis.moneyLeftAfterPlan;

		const incomeSacrificePct = grossIncome > 0
			? Number(((incomeSacrifice / grossIncome) * 100).toFixed(1))
			: 0;
		const moneyLeftPctOfGross = grossIncome > 0
			? Number(((moneyLeftAfterPlan / grossIncome) * 100).toFixed(1))
			: 0;
		const moneyLeftVsLastMonthPct =
			typeof previousMoneyLeftAfterPlan === "number" && previousMoneyLeftAfterPlan !== 0
				? Number((((moneyLeftAfterPlan - previousMoneyLeftAfterPlan) / Math.abs(previousMoneyLeftAfterPlan)) * 100).toFixed(1))
				: null;
		const planStatusTag = analysis.isOnPlan ? "on_plan" : "over_plan";

		return NextResponse.json({
			budgetPlanId,
			month: analysis.month,
			year: analysis.year,
			monthKey: analysis.monthKey,

			// Income
			incomeItems: analysis.incomeItems.map((i) => ({
				id: i.id,
				name: i.name,
				amount: i.amount,
			})),
			grossIncome: analysis.grossIncome,
			sourceCount: analysis.sourceCount,

			// Expenses
			plannedExpenses: analysis.plannedExpenses,
			paidExpenses: analysis.paidExpenses,

			// Debts
			plannedDebtPayments: analysis.plannedDebtPayments,
			paidDebtPayments: analysis.paidDebtPaymentsFromIncome,

			// Allocations / sacrifice
			monthlyAllowance: analysis.monthlyAllowance,
			incomeSacrifice: analysis.incomeSacrifice,
			setAsideBreakdown: {
				savings: analysis.setAsideBreakdown.savings,
				emergency: analysis.setAsideBreakdown.emergency,
				investments: analysis.setAsideBreakdown.investments,
				custom: analysis.setAsideBreakdown.custom,
			},

			// Summary
			plannedBills: analysis.plannedBills,
			paidBillsSoFar: analysis.paidBillsSoFar,
			remainingBills: analysis.remainingBills,
			moneyLeftAfterPlan,
			previousMoneyLeftAfterPlan,
			incomeLeftRightNow: analysis.incomeLeftRightNow,
			moneyOutTotal: analysis.moneyOutTotal,
			isOnPlan: analysis.isOnPlan,

			// Server-derived summary helpers (canonical for all clients)
			incomeSacrificePct,
			moneyLeftPctOfGross,
			moneyLeftVsLastMonthPct,
			planStatusTag,
			planStatusDescription: analysis.isOnPlan ? "On plan" : "Over plan",
		});
	} catch (error) {
		console.error("[bff/income-month] Error:", error);
		return NextResponse.json(
			{ error: "Failed to load income month data" },
			{ status: 500 },
		);
	}
}
