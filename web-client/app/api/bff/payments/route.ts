import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { prisma } from "@/lib/prisma";
import { getDebtSummaryForPlan } from "@/lib/debts/summary";
import { getDebtMonthlyPayment } from "@/lib/debts/calculate";
import { resolveExpenseLogo } from "@/lib/expenses/logoResolver";
import { isLegacyPlaceholderExpenseRow } from "@/lib/expenses/legacyPlaceholders";
import { isNonDebtCategoryName } from "@/lib/expenses/helpers";
import type { DebtItem } from "@/types/helpers/debts";

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
 	isMovedToDebt: boolean;
	dueDate: Date | null;
	category: { name: string } | null;
}>): Array<{ id: string; name: string; logoUrl: string | null; dueAmount: number; isMissedPayment: boolean }> {
	const isIncomeSacrificeByName = (name: string): boolean => {
		const normalized = name.trim().toLowerCase();
		return (
			normalized === "home deposit" ||
			normalized === "emergency funds" ||
			normalized === "single saving" ||
			normalized === "monthly allowance" ||
			normalized.endsWith(" allowance")
		);
	};

	const shouldHideExpenseFromUpcoming = (expense: {
		name: string;
		merchantDomain: string | null;
		logoUrl: string | null;
		isAllocation: boolean;
		isMovedToDebt: boolean;
		dueDate: Date | null;
		category: { name: string } | null;
	}) => {
		if (expense.isAllocation) return true;
		if (isNonDebtCategoryName(expense.category?.name)) return true;
		if (
			isLegacyPlaceholderExpenseRow({
				name: expense.name,
				dueDate: expense.dueDate,
				isAllocation: expense.isAllocation,
				isMovedToDebt: expense.isMovedToDebt,
				merchantDomain: expense.merchantDomain,
				logoUrl: expense.logoUrl,
			})
		)
			return true;
		return isIncomeSacrificeByName(expense.name);
	};

	return rows
		.filter((e) => !shouldHideExpenseFromUpcoming(e))
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

function isPeriodAtOrBefore(period: { year: number; month: number }, selected: { year: number; month: number }): boolean {
	if (period.year < selected.year) return true;
	if (period.year > selected.year) return false;
	return period.month <= selected.month;
}

function shouldHideAllocationLikeDebt(debt: {
	sourceType?: string | null;
	sourceCategoryName?: string | null;
	sourceExpenseName?: string | null;
	name?: string | null;
}) {
	if (debt.sourceType !== "expense") return false;
	if (isNonDebtCategoryName(debt.sourceCategoryName)) return true;
	return isLegacyPlaceholderExpenseRow({ name: debt.sourceExpenseName ?? debt.name });
}

async function filterDebtsForSelectedPeriod(params: {
	budgetPlanId: string;
	debts: DebtItem[];
	selectedMonth: number;
	selectedYear: number;
}): Promise<DebtItem[]> {
	const { budgetPlanId, debts, selectedMonth, selectedYear } = params;
	const expenseDebtSourceIds = Array.from(
		new Set(
			debts
				.filter((d) => d.sourceType === "expense")
				.map((d) => String(d.sourceExpenseId ?? "").trim())
				.filter(Boolean)
		)
	);

	if (expenseDebtSourceIds.length === 0) return debts;

	const sourceExpenses = await prisma.expense.findMany({
		where: { budgetPlanId, id: { in: expenseDebtSourceIds } },
		select: { id: true, year: true, month: true },
	});

	const sourcePeriodByExpenseId = new Map(
		sourceExpenses.map((expense) => [expense.id, { year: expense.year, month: expense.month }] as const)
	);

	return debts.filter((debt) => {
		if (debt.sourceType !== "expense") return true;
		const sourceExpenseId = String(debt.sourceExpenseId ?? "").trim();
		if (!sourceExpenseId) return false;
		const sourcePeriod = sourcePeriodByExpenseId.get(sourceExpenseId);
		if (!sourcePeriod) return false;
		return isPeriodAtOrBefore(sourcePeriod, { year: selectedYear, month: selectedMonth });
	});
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
			isMovedToDebt: true,
			dueDate: true,
			category: { select: { name: true } },
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

		const visibleDebts = await filterDebtsForSelectedPeriod({
			budgetPlanId,
			debts: debtSummary.activeDebts.filter((debt) => !shouldHideAllocationLikeDebt(debt)),
			selectedMonth: resultMonth,
			selectedYear: resultYear,
		});

		return NextResponse.json({
			budgetPlanId,
			year: resultYear,
			month: resultMonth,
			isNextPeriodFallback,
			expenses: dueExpenses,
			debts: visibleDebts
				.map((d) => {
					const dueAmount = Math.min(getDebtMonthlyPayment(d), Math.max(0, Number(d.currentBalance ?? 0)));
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
