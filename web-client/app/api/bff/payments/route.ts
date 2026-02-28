import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { prisma } from "@/lib/prisma";
import { getDebtSummaryForPlan } from "@/lib/debts/summary";
import { getDebtMonthlyPayment } from "@/lib/debts/calculate";
import { resolveExpenseLogo } from "@/lib/expenses/logoResolver";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	return Number((value as any).toString?.() ?? value);
}

/**
 * GET /api/bff/payments?budgetPlanId=<optional>
 *
 * Returns the current-month payments view for mobile:
 * - Expenses for the current month with computed dueAmount (amount - paidAmount)
 * - Debts with computed dueAmount for this month (same as debt summary monthly payment)
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

		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth() + 1;

		const expenses = await prisma.expense.findMany({
			where: { budgetPlanId, year, month },
			orderBy: [{ createdAt: "asc" }],
			select: {
				id: true,
				name: true,
				merchantDomain: true,
				logoUrl: true,
				amount: true,
				paid: true,
				paidAmount: true,
				isAllocation: true,
			},
		});

		let debtSummary;
		try {
			debtSummary = await getDebtSummaryForPlan(budgetPlanId, {
				includeExpenseDebts: true,
				ensureSynced: true,
			});
		} catch (error) {
			console.error("Payments: debt sync failed, retrying without ensureSynced:", error);
			debtSummary = await getDebtSummaryForPlan(budgetPlanId, {
				includeExpenseDebts: true,
				ensureSynced: false,
			});
		}

		return NextResponse.json({
			budgetPlanId,
			year,
			month,
			expenses: expenses
				.filter((e) => !e.isAllocation)
				.map((e) => {
					const amount = decimalToNumber(e.amount);
					const paidAmount = decimalToNumber(e.paidAmount);
					const dueAmount = Math.max(0, amount - paidAmount);
					const fallbackLogo = resolveExpenseLogo(e.name, e.merchantDomain).logoUrl;
					return {
						id: e.id,
						name: e.name,
						logoUrl: e.logoUrl ?? fallbackLogo ?? null,
						dueAmount,
						isMissedPayment: dueAmount > 0,
					};
				})
				.filter((e) => e.dueAmount > 0),
			debts: debtSummary.allDebts
				.map((d) => {
					const dueAmount = getDebtMonthlyPayment(d);
					return {
						id: d.id,
						name: d.sourceType === "expense" ? String(d.sourceExpenseName ?? d.name) : d.name,
						logoUrl: d.logoUrl ?? resolveExpenseLogo(String(d.sourceExpenseName ?? d.name)).logoUrl ?? null,
						dueAmount,
						isMissedPayment: d.sourceType === "expense",
					};
				})
				.filter((d) => d.dueAmount > 0),
		});
	} catch (error) {
		console.error("Failed to compute payments:", error);
		const isProd = process.env.NODE_ENV === "production";
		return NextResponse.json(
			{
				error: "Failed to compute payments",
				...(isProd ? {} : { detail: String((error as any)?.message ?? error) }),
			},
			{ status: 500 }
		);
	}
}
