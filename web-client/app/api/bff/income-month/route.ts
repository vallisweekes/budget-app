import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getAllIncome } from "@/lib/income/store";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { prisma } from "@/lib/prisma";
import type { MonthKey } from "@/types";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "string") return Number(value);
	if (typeof value === "object") {
		const maybeDecimal = value as { toNumber?: () => number; toString?: () => string };
		if (typeof maybeDecimal.toNumber === "function") return maybeDecimal.toNumber();
		if (typeof maybeDecimal.toString === "function") return Number(maybeDecimal.toString());
	}
	return Number(value);
}

/**
 * GET /api/bff/income-month?month=2&year=2026&budgetPlanId=<optional>
 *
 * Returns all computed data for a single income month view —
 * the SAME calculations as web-client/app/admin/income/IncomeMonthPage.tsx.
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

		const monthParam = Number(searchParams.get("month"));
		const yearParam = Number(searchParams.get("year"));
		const month = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
			? monthParam
			: new Date().getMonth() + 1;
		const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();

		const monthKey = monthNumberToKey(month as 1|2|3|4|5|6|7|8|9|10|11|12) as MonthKey;

		// ── Income ──────────────────────────────────────────────
		const incomeByMonth = await getAllIncome(budgetPlanId, year);
		const incomeItems = incomeByMonth[monthKey] ?? [];
		const grossIncome = incomeItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);

		// ── Expenses ────────────────────────────────────────────
		const expenseAgg = await prisma.expense.aggregate({
			where: { budgetPlanId, year, month },
			_sum: { amount: true, paidAmount: true },
		});
		const plannedExpenses = decimalToNumber(expenseAgg._sum.amount);
		const paidExpenses = decimalToNumber(expenseAgg._sum.paidAmount);

		// ── Allocations (income sacrifice) ──────────────────────
		const allocationSnapshot = await getMonthlyAllocationSnapshot(budgetPlanId, monthKey, { year });
		const customAllocationsSnapshot = await getMonthlyCustomAllocationsSnapshot(budgetPlanId, monthKey, { year });

		const monthlyAllowance = Number(allocationSnapshot.monthlyAllowance ?? 0);
		const savingsContribution = Number(allocationSnapshot.monthlySavingsContribution ?? 0);
		const emergencyContribution = Number(allocationSnapshot.monthlyEmergencyContribution ?? 0);
		const investmentContribution = Number(allocationSnapshot.monthlyInvestmentContribution ?? 0);
		const plannedSetAsideFromAllocations = savingsContribution + emergencyContribution + investmentContribution;
		const customSetAsideTotal = Number(customAllocationsSnapshot.total ?? 0);
		const plannedSetAside = plannedSetAsideFromAllocations + customSetAsideTotal + monthlyAllowance;

		// ── Debts ───────────────────────────────────────────────
		const dueDebts = await prisma.debt.findMany({
			where: {
				budgetPlanId,
				paid: false,
				currentBalance: { gt: 0 },
				defaultPaymentSource: "income",
			},
			select: { id: true, amount: true },
		});
		const totalDueDebts = dueDebts.reduce((sum, d) => sum + decimalToNumber(d.amount), 0);

		const paidDebtPaymentsAgg = await prisma.debtPayment.aggregate({
			where: {
				debt: { budgetPlanId },
				year,
				month,
				source: "income",
			},
			_sum: { amount: true },
		});
		const paidDebtPaymentsFromIncome = decimalToNumber(paidDebtPaymentsAgg._sum.amount);
		const debtsDueThisMonth = Math.max(0, totalDueDebts - paidDebtPaymentsFromIncome);

		// ── Derived values (same as web IncomeMonthPage) ────────
		const plannedBills = plannedExpenses + debtsDueThisMonth;
		const paidBillsSoFar = paidExpenses + paidDebtPaymentsFromIncome;
		const remainingBills = Math.max(0, plannedBills - paidBillsSoFar);
		const moneyLeftAfterPlan = grossIncome - (plannedBills + monthlyAllowance + plannedSetAside);
		const incomeLeftRightNow = grossIncome - paidBillsSoFar - plannedSetAside;
		const moneyOutTotal = plannedBills + monthlyAllowance + plannedSetAside;

		return NextResponse.json({
			budgetPlanId,
			month,
			year,
			monthKey,

			// Income
			incomeItems: incomeItems.map((i) => ({
				id: i.id,
				name: i.name,
				amount: i.amount,
			})),
			grossIncome,
			sourceCount: incomeItems.length,

			// Expenses
			plannedExpenses,
			paidExpenses,

			// Debts
			plannedDebtPayments: debtsDueThisMonth,
			paidDebtPayments: paidDebtPaymentsFromIncome,

			// Allocations / sacrifice
			monthlyAllowance,
			incomeSacrifice: plannedSetAside,
			setAsideBreakdown: {
				savings: savingsContribution,
				emergency: emergencyContribution,
				investments: investmentContribution,
				custom: customSetAsideTotal,
			},

			// Summary
			plannedBills,
			paidBillsSoFar,
			remainingBills,
			moneyLeftAfterPlan,
			incomeLeftRightNow,
			moneyOutTotal,
			isOnPlan: moneyLeftAfterPlan >= 0,
		});
	} catch (error) {
		console.error("[bff/income-month] Error:", error);
		return NextResponse.json(
			{ error: "Failed to load income month data" },
			{ status: 500 },
		);
	}
}
