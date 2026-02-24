import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getDebtSummaryForPlan } from "@/lib/debts/summary";
import { computeDebtTips } from "@/lib/debts/insights";
import { getDebtMonthlyPayment, getTotalMonthlyDebtPayments } from "@/lib/debts/calculate";
import { formatExpenseDebtCardTitle, formatYearMonthLabel } from "@/lib/helpers/debts/expenseDebtLabels";
import { prisma } from "@/lib/prisma";

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
		const shouldSync = searchParams.get("sync") === "1";
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
					ensureSynced: shouldSync,
				});
			} catch (error) {
				// Debt sync routines are helpful but should not hard-fail the UI.
				console.error("Debt summary: failed, retrying without ensureSynced:", error);
				return await getDebtSummaryForPlan(budgetPlanId, {
					includeExpenseDebts: true,
					ensureSynced: false,
				});
			}
		})();

		const debtIds = summary.allDebts.map((d) => d.id);
		const now = new Date();
		const paymentYear = now.getUTCFullYear();
		const paymentMonth = now.getUTCMonth() + 1;
		const expenseIds = Array.from(
			new Set(summary.allDebts.map((d) => String(d.sourceExpenseId ?? "").trim()).filter(Boolean))
		);
		const [lastPaymentRows, paidThisMonthRows, lastExpensePaymentRows, paidExpenseRows] = await Promise.all([
			debtIds.length
				? prisma.debtPayment.groupBy({
						by: ["debtId"],
						where: { debtId: { in: debtIds } },
						_max: { paidAt: true },
				  })
				: Promise.resolve([]),
			debtIds.length
				? prisma.debtPayment.groupBy({
						by: ["debtId"],
						where: { debtId: { in: debtIds }, year: paymentYear, month: paymentMonth },
						_sum: { amount: true },
				  })
				: Promise.resolve([]),
			expenseIds.length
				? prisma.expensePayment.groupBy({
						by: ["expenseId"],
						where: { expenseId: { in: expenseIds } },
						_max: { paidAt: true },
				  })
				: Promise.resolve([]),
			expenseIds.length
				? prisma.expense.findMany({
						where: { id: { in: expenseIds } },
						select: { id: true, amount: true, paidAmount: true, paid: true, updatedAt: true },
				  })
				: Promise.resolve([]),
		]);
		const lastPaidAtByDebtId = new Map(
			lastPaymentRows.map((row) => [row.debtId, row._max.paidAt ? row._max.paidAt.toISOString() : null])
		);
		const lastPaidAtByExpenseId = new Map(
			lastExpensePaymentRows.map((row) => [row.expenseId, row._max.paidAt ? row._max.paidAt.toISOString() : null])
		);
		const paidThisMonthByDebtId = new Map(
			paidThisMonthRows.map((row) => [row.debtId, Number(row._sum.amount ?? 0)])
		);
		const fallbackLastPaidAtByExpenseId = new Map(
			paidExpenseRows
				.filter((e) => {
					const amount = Number(e.amount);
					const paidAmount = Number(e.paidAmount);
					return Boolean(e.paid) || (Number.isFinite(amount) && Number.isFinite(paidAmount) && paidAmount >= amount && amount > 0);
				})
				.map((e) => [e.id, e.updatedAt?.toISOString?.() ?? null])
		);

		// Add computed monthly payment to each debt
		const debtsWithPayments = summary.allDebts.map((d) => {
			const computedMonthlyPayment = getDebtMonthlyPayment(d);
			const paidThisMonth = paidThisMonthByDebtId.get(d.id) ?? 0;
			const dueThisMonth = Math.max(0, computedMonthlyPayment);
			const isPaymentMonthPaid = dueThisMonth > 0 && paidThisMonth >= dueThisMonth;

			return {
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
			isCarriedOverDebt: d.sourceType === "expense",
			sourceMonthKey: d.sourceMonthKey ?? null,
			sourceCategoryName: d.sourceCategoryName ?? null,
			sourceExpenseName: d.sourceExpenseName ?? null,
			lastPaidAt:
				lastPaidAtByDebtId.get(d.id) ??
				lastPaidAtByExpenseId.get(String(d.sourceExpenseId ?? "").trim()) ??
				fallbackLastPaidAtByExpenseId.get(String(d.sourceExpenseId ?? "").trim()) ??
				null,
			computedMonthlyPayment,
			dueThisMonth,
			paidThisMonth,
			isPaymentMonthPaid,
			isActive: (d.currentBalance ?? 0) > 0,
			};
		});

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
