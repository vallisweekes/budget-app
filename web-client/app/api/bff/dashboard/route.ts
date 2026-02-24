import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getDashboardPlanData } from "@/lib/helpers/dashboard/getDashboardPlanData";
import { getBudgetPlanMeta } from "@/lib/helpers/dashboard/getBudgetPlanMeta";
import { getDebtSummaryForPlan } from "@/lib/debts/summary";
import { computeDebtTips } from "@/lib/debts/insights";
import { getDashboardExpenseInsights } from "@/lib/helpers/dashboard/getDashboardExpenseInsights";
import { getIncomeMonthsCoverageByPlan } from "@/lib/helpers/dashboard/getIncomeMonthsCoverageByPlan";
import { getLargestExpensesByPlan } from "@/lib/helpers/dashboard/getLargestExpensesByPlan";
import { getMultiPlanHealthTips } from "@/lib/helpers/dashboard/getMultiPlanHealthTips";
import { getAllPlansDashboardData } from "@/lib/helpers/dashboard/getAllPlansDashboardData";
import { MONTHS } from "@/lib/constants/time";
import { currentMonthKey } from "@/lib/helpers/monthKey";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/**
 * GET /api/bff/dashboard?budgetPlanId=<optional>
 *
 * Returns the full server-computed dashboard payload.
 * This is the SAME data the web client's DashboardView computes server-side,
 * now available as a JSON API for the mobile client (or any external consumer).
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

		const now = new Date();
		const selectedYear = now.getFullYear();

		const session = await getServerSession(authOptions);
		const sessionUser = session?.user;
		const username = sessionUser?.username ?? sessionUser?.name;

		// 1) Core plan data (income, expenses, allocations, goals, categories)
		// This is required for the dashboard; let it throw if it truly can't compute.
		const currentPlanData = await getDashboardPlanData(budgetPlanId, now);
		const month = MONTHS[currentPlanData.monthNum - 1] ?? currentMonthKey();

		// 2) Plan meta (payDate, homepageGoalIds)
		const { payDate, homepageGoalIds } = await getBudgetPlanMeta(budgetPlanId);

		// Everything below is "best effort". If one section fails (e.g. debt sync),
		// return the rest of the dashboard rather than a full 500.
		const [expenseInsightsBase, allPlansData, debtSummary] = await Promise.all([
			(async () => {
				try {
					return await getDashboardExpenseInsights({
						budgetPlanId,
						payDate,
						now,
						userId,
					});
				} catch (error) {
					console.error("Dashboard: expense insights failed:", error);
					return { recap: null, upcoming: [], recapTips: [] };
				}
			})(),
			(async () => {
				try {
					return await getAllPlansDashboardData({
						budgetPlanId,
						currentPlanData,
						now,
						session,
						username,
					});
				} catch (error) {
					console.error("Dashboard: all plans data failed:", error);
					return { [budgetPlanId]: currentPlanData };
				}
			})(),
			(async () => {
				try {
					return await getDebtSummaryForPlan(budgetPlanId, {
						includeExpenseDebts: true,
						ensureSynced: false,
					});
				} catch (error) {
					console.error("Dashboard: debt summary failed:", error);
					return {
						regularDebts: [],
						expenseDebts: [],
						allDebts: [],
						activeDebts: [],
						activeRegularDebts: [],
						activeExpenseDebts: [],
						creditCards: [],
						totalDebtBalance: 0,
					};
				}
			})(),
		]);
		const planIds = Object.keys(allPlansData);

		const [largestExpensesByPlan, incomeMonthsCoverageByPlan] = await Promise.all([
			(async () => {
				try {
					return await getLargestExpensesByPlan({
						planIds,
						now,
						perPlanLimit: 3,
					});
				} catch (error) {
					console.error("Dashboard: largest expenses failed:", error);
					return {};
				}
			})(),
			(async () => {
				try {
					return await getIncomeMonthsCoverageByPlan({
						planIds,
						year: selectedYear,
					});
				} catch (error) {
					console.error("Dashboard: income coverage failed:", error);
					return {};
				}
			})(),
		]);

		const multiPlanTips = await (async () => {
			try {
				return await getMultiPlanHealthTips({
					planIds,
					now,
					payDate,
					largestExpensesByPlan,
				});
			} catch (error) {
				console.error("Dashboard: multi-plan tips failed:", error);
				return [];
			}
		})();

		const debts = debtSummary.activeDebts;
		const debtTips = (() => {
			try {
				return computeDebtTips({ debts, totalIncome: currentPlanData.totalIncome });
			} catch (error) {
				console.error("Dashboard: debt tips failed:", error);
				return [];
			}
		})();
		const totalDebtBalance = debtSummary.totalDebtBalance;

		const expenseInsights = {
			...expenseInsightsBase,
			recapTips: [
				...(expenseInsightsBase.recapTips ?? []),
				...multiPlanTips,
				...debtTips,
			],
		};

		return NextResponse.json({
			budgetPlanId,
			month,
			year: currentPlanData.year,
			monthNum: currentPlanData.monthNum,

			// Budget totals
			totalIncome: currentPlanData.totalIncome,
			totalExpenses: currentPlanData.totalExpenses,
			remaining: currentPlanData.remaining,

			// Allocations
			totalAllocations: currentPlanData.totalAllocations,
			plannedDebtPayments: currentPlanData.plannedDebtPayments,
			plannedSavingsContribution: currentPlanData.plannedSavingsContribution,
			plannedEmergencyContribution: currentPlanData.plannedEmergencyContribution,
			plannedInvestments: currentPlanData.plannedInvestments,
			incomeAfterAllocations: currentPlanData.incomeAfterAllocations,

			// Categories with expense breakdowns
			categoryData: currentPlanData.categoryData,

			// Goals
			goals: currentPlanData.goals,
			homepageGoalIds,

			// Debts
			debts: debts.map((d) => ({
				id: d.id,
				name: d.name,
				type: d.type,
				currentBalance: d.currentBalance,
				paidAmount: d.paidAmount,
				monthlyMinimum: d.monthlyMinimum ?? null,
				interestRate: d.interestRate ?? null,
				installmentMonths: d.installmentMonths ?? null,
				amount: d.amount ?? 0,
				creditLimit: d.creditLimit ?? null,
				sourceType: d.sourceType ?? null,
			})),
			totalDebtBalance,

			// Expense insights
			expenseInsights,

			// Multi-plan data
			allPlansData,
			largestExpensesByPlan,
			incomeMonthsCoverageByPlan,

			// Meta
			payDate,
		});
	} catch (error) {
		console.error("Failed to compute dashboard:", error);
		const isProd = process.env.NODE_ENV === "production";
		return NextResponse.json(
			{
				error: "Failed to compute dashboard data",
				...(isProd ? {} : { detail: String((error as any)?.message ?? error) }),
			},
			{ status: 500 }
		);
	}
}
