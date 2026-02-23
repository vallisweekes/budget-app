import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getDebtSummaryForPlan } from "@/lib/debts/summary";
import { computeDebtTips } from "@/lib/debts/insights";
import { getDebtMonthlyPayment, getTotalMonthlyDebtPayments } from "@/lib/debts/calculate";
import { formatExpenseDebtCardTitle, formatYearMonthLabel } from "@/lib/helpers/debts/expenseDebtLabels";

export const runtime = "nodejs";

const TYPE_LABELS: Record<string, string> = {
	credit_card: "Credit Card",
	store_card: "Store Card",
	loan: "Loan",
	mortgage: "Mortgage",
	hire_purchase: "Hire Purchase",
	other: "Other",
};

function getDebtDisplayTitle(debt: { name: string; sourceType?: string | null; sourceExpenseName?: string | null; sourceCategoryName?: string | null; sourceMonthKey?: string | null }): string {
	if (debt.sourceType === "expense") return formatExpenseDebtCardTitle(debt as any);
	return debt.name;
}

function getDebtDisplaySubtitle(debt: { type: string; sourceType?: string | null; sourceCategoryName?: string | null; sourceMonthKey?: string | null }): string {
	if (debt.sourceType === "expense") {
		const category = String(debt.sourceCategoryName ?? "").trim();
		const monthLabel = formatYearMonthLabel(debt.sourceMonthKey);
		const left = category || "Expense";
		return monthLabel ? `${left} · ${monthLabel}` : left;
	}

	return TYPE_LABELS[debt.type] ?? debt.type;
}

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

		const summary = await (async () => {
			try {
				return await getDebtSummaryForPlan(budgetPlanId, {
					includeExpenseDebts: true,
					ensureSynced: true,
				});
			} catch (error) {
				// Debt sync routines are helpful but should not hard-fail the UI.
				console.error("Debt summary: sync failed, retrying without ensureSynced:", error);
				return await getDebtSummaryForPlan(budgetPlanId, {
					includeExpenseDebts: true,
					ensureSynced: false,
				});
			}
		})();

		// Add computed monthly payment to each debt
		const debtsWithPayments = summary.allDebts.map((d) => ({
			id: d.id,
			name: d.name,
			type: d.type,
			displayTitle: getDebtDisplayTitle(d),
			displaySubtitle: getDebtDisplaySubtitle(d),
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
			sourceMonthKey: d.sourceMonthKey ?? null,
			sourceCategoryName: d.sourceCategoryName ?? null,
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
		const isProd = process.env.NODE_ENV === "production";
		return NextResponse.json(
			{
				error: "Failed to compute debt summary",
				...(isProd ? {} : { detail: String((error as any)?.message ?? error) }),
			},
			{ status: 500 }
		);
	}
}
