import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getDebtSummaryForPlan } from "@/lib/debts/summary";
import { computeDebtTips } from "@/lib/debts/insights";
import { getDebtMonthlyPayment, getTotalMonthlyDebtPayments } from "@/lib/debts/calculate";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/**
 * GET /api/bff/debt-summary?budgetPlanId=<optional>
 *
 * Returns a comprehensive debt summary with:
 * - All debts (regular + expense-generated) with computed monthly payment amounts
 * - Active vs paid breakdown
 * - Total debt balance
 * - Credit card debts
 * - Actionable tips/insights
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

		const summary = await getDebtSummaryForPlan(budgetPlanId, {
			includeExpenseDebts: true,
			ensureSynced: true,
		});

		// Add computed monthly payment to each debt
		const debtsWithPayments = summary.allDebts.map((d) => ({
			id: d.id,
			name: d.name,
			type: d.type,
			currentBalance: d.currentBalance,
			initialBalance: d.initialBalance ?? d.currentBalance,
			paidAmount: d.paidAmount,
			monthlyMinimum: d.monthlyMinimum ?? null,
			interestRate: d.interestRate ?? null,
			installmentMonths: d.installmentMonths ?? null,
			amount: d.amount ?? 0,
			paid: d.paid,
			creditLimit: d.creditLimit ?? null,
			dueDay: d.dueDay ?? null,
			sourceType: d.sourceType ?? null,
			sourceExpenseName: d.sourceExpenseName ?? null,
			computedMonthlyPayment: getDebtMonthlyPayment(d),
			isActive: (d.currentBalance ?? 0) > 0,
		}));

		const totalMonthlyDebtPayments = getTotalMonthlyDebtPayments(summary.allDebts);

		// Compute tips
		const tips = computeDebtTips({
			debts: summary.activeDebts,
		});

		return NextResponse.json({
			debts: debtsWithPayments,
			activeCount: summary.activeDebts.length,
			paidCount: summary.allDebts.length - summary.activeDebts.length,
			totalDebtBalance: summary.totalDebtBalance,
			totalMonthlyDebtPayments,
			creditCardCount: summary.creditCards.length,
			regularDebtCount: summary.regularDebts.length,
			expenseDebtCount: summary.expenseDebts.length,
			tips,
		});
	} catch (error) {
		console.error("Failed to compute debt summary:", error);
		return NextResponse.json(
			{ error: "Failed to compute debt summary" },
			{ status: 500 }
		);
	}
}
