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

function nextMonthYear(month: number, year: number): { month: number; year: number } {
	if (month >= 12) return { month: 1, year: year + 1 };
	return { month: month + 1, year };
}

function mapDueExpenses(rows: Array<{
	id: string;
	name: string;
	merchantDomain: string | null;
	logoUrl: string | null;
	amount: unknown;
	paidAmount: unknown;
	isAllocation: boolean;
}>): Array<{ id: string; name: string; logoUrl: string | null; dueAmount: number; isMissedPayment: boolean }> {
	return rows
		.filter((e) => !e.isAllocation)
		.map((e) => {
			const amount = decimalToNumber(e.amount);
			const paidAmount = decimalToNumber(e.paidAmount);
			const dueAmount = Math.max(0, amount - paidAmount);
			const fallbackLogo = resolveExpenseLogo(e.name, e.merchantDomain ?? undefined).logoUrl;
			return {
				id: e.id,
				name: e.name,
				logoUrl: e.logoUrl ?? fallbackLogo ?? null,
				dueAmount,
				isMissedPayment: dueAmount > 0,
			};
		})
		.filter((e) => e.dueAmount > 0);
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

		const expenseSelect = {
			id: true,
			name: true,
			merchantDomain: true,
			logoUrl: true,
			amount: true,
			paid: true,
			paidAmount: true,
			isAllocation: true,
		} as const;

		const expenses = await prisma.expense.findMany({
			where: { budgetPlanId, year, month },
			orderBy: [{ createdAt: "asc" }],
			select: expenseSelect,
		});

		let dueExpenses = mapDueExpenses(expenses);
		let resultMonth = month;
		let resultYear = year;
		let isNextPeriodFallback = false;

		if (dueExpenses.length === 0) {
			const next = nextMonthYear(month, year);
			const nextExpenses = await prisma.expense.findMany({
				where: { budgetPlanId, year: next.year, month: next.month },
				orderBy: [{ createdAt: "asc" }],
				select: expenseSelect,
			});
			const nextDueExpenses = mapDueExpenses(nextExpenses);
			if (nextDueExpenses.length > 0) {
				dueExpenses = nextDueExpenses;
				resultMonth = next.month;
				resultYear = next.year;
				isNextPeriodFallback = true;
			}
		}

		// Keep this endpoint fast for modal navigation from Dashboard "See all".
		// Full debt sync can exceed mobile timeout on large plans and is not required
		// for a read-only due-amount list.
		const debtSummary = await getDebtSummaryForPlan(budgetPlanId, {
			includeExpenseDebts: true,
			ensureSynced: false,
		});

		return NextResponse.json({
			budgetPlanId,
			year: resultYear,
			month: resultMonth,
			isNextPeriodFallback,
			expenses: dueExpenses,
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
