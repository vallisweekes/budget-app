import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getDashboardPlanData } from "@/lib/helpers/dashboard/getDashboardPlanData";
import { getBudgetPlanMeta } from "@/lib/helpers/dashboard/getBudgetPlanMeta";
import { getDebtSummaryForPlan } from "@/lib/debts/summary";
import { computeDebtTips } from "@/lib/debts/insights";
import { getDashboardExpenseInsights } from "@/lib/helpers/dashboard/getDashboardExpenseInsights";
import { getAiBudgetTips } from "@/lib/ai/budgetTips";
import { getOnboardingStarterTips } from "@/lib/ai/onboardingStarterTips";
import { prioritizeRecapTips } from "@/lib/expenses/insights";
import { getIncomeMonthsCoverageByPlan } from "@/lib/helpers/dashboard/getIncomeMonthsCoverageByPlan";
import { getLargestExpensesByPlan } from "@/lib/helpers/dashboard/getLargestExpensesByPlan";
import { getMultiPlanHealthTips } from "@/lib/helpers/dashboard/getMultiPlanHealthTips";
import { getAllPlansDashboardData } from "@/lib/helpers/dashboard/getAllPlansDashboardData";
import { MONTHS } from "@/lib/constants/time";
import { currentMonthKey } from "@/lib/helpers/monthKey";
import { resolveExpenseLogo } from "@/lib/expenses/logoResolver";
import { prisma } from "@/lib/prisma";

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
		const selectedYear = now.getFullYear();
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { name: true },
		});
		const username = user?.name ?? null;

		// Best-effort onboarding context: never let dashboard fail due to schema/client mismatch.
		let onboarding:
			| {
				mainGoal: unknown;
				mainGoals?: unknown;
				occupation: unknown;
				monthlySalary: unknown;
				expenseOneName: unknown;
				expenseOneAmount: unknown;
				expenseTwoName: unknown;
				expenseTwoAmount: unknown;
				expenseThreeName: unknown;
				expenseThreeAmount: unknown;
				expenseFourName: unknown;
				expenseFourAmount: unknown;
				hasAllowance: unknown;
				allowanceAmount: unknown;
				hasDebtsToManage: unknown;
				debtAmount: unknown;
				debtNotes: unknown;
			}
			| null = null;
		try {
			onboarding = await prisma.userOnboardingProfile.findUnique({
				where: { userId },
				select: {
					mainGoal: true,
					mainGoals: true,
					occupation: true,
					monthlySalary: true,
					expenseOneName: true,
					expenseOneAmount: true,
					expenseTwoName: true,
					expenseTwoAmount: true,
					expenseThreeName: true,
					expenseThreeAmount: true,
					expenseFourName: true,
					expenseFourAmount: true,
					hasAllowance: true,
					allowanceAmount: true,
					hasDebtsToManage: true,
					debtAmount: true,
					debtNotes: true,
				},
			});
		} catch (error) {
			console.error("Dashboard: onboarding fetch failed:", error);
			try {
				const legacy = await prisma.userOnboardingProfile.findUnique({
					where: { userId },
					select: {
						mainGoal: true,
						occupation: true,
						monthlySalary: true,
						expenseOneName: true,
						expenseOneAmount: true,
						expenseTwoName: true,
						expenseTwoAmount: true,
						hasAllowance: true,
						allowanceAmount: true,
						hasDebtsToManage: true,
						debtAmount: true,
						debtNotes: true,
					},
				});
				onboarding = legacy
					? {
						...legacy,
						expenseThreeName: null as unknown,
						expenseThreeAmount: null as unknown,
						expenseFourName: null as unknown,
						expenseFourAmount: null as unknown,
					}
					: null;
			} catch (legacyError) {
				console.error("Dashboard: onboarding legacy fetch failed:", legacyError);
				onboarding = null;
			}
		}

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
						userId,
						session: null,
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
		const sourceExpenseIds = Array.from(
			new Set(
				debts
					.map((d) => d.sourceExpenseId)
					.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
			)
		);
		const debtLogoByExpenseId = new Map<string, string>();
		if (sourceExpenseIds.length > 0) {
			try {
				const sourceExpenseRows = await prisma.expense.findMany({
					where: { id: { in: sourceExpenseIds }, budgetPlanId },
					select: { id: true, logoUrl: true },
				});
				for (const row of sourceExpenseRows) {
					if (typeof row.logoUrl === "string" && row.logoUrl.trim().length > 0) {
						debtLogoByExpenseId.set(row.id, row.logoUrl.trim());
					}
				}
			} catch (err) {
				console.error("Dashboard: debt logo lookup failed:", err);
			}
		}

		// Query how much has been paid against each debt IN THE CURRENT MONTH
		// so we can exclude already-paid debts from "Upcoming Debts".
		const debtIds = debts.map((d) => d.id);
		const currentMonthPaidByDebtId = new Map<string, number>();
		if (debtIds.length > 0) {
			try {
				// NOTE: Mobile creates DebtPayment rows with `year/month` derived from `paidAt` (UTC),
				// so we must group by the current UTC calendar month (not the budget plan month).
				const paymentYear = now.getUTCFullYear();
				const paymentMonth = now.getUTCMonth() + 1;

				const monthPayments = await prisma.debtPayment.groupBy({
					by: ["debtId"],
					where: {
						debtId: { in: debtIds },
						year: paymentYear,
						month: paymentMonth,
					},
					_sum: { amount: true },
				});
				for (const row of monthPayments) {
					const total = Number(row._sum.amount ?? 0);
					if (total > 0) currentMonthPaidByDebtId.set(row.debtId, total);
				}
			} catch (err) {
				console.error("Dashboard: debt month-payment query failed:", err);
			}
		}

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
			recapTips: prioritizeRecapTips([
				...(expenseInsightsBase.recapTips ?? []),
				...multiPlanTips,
				...debtTips,
			], 6),
		};

		const aiDashboardTips = await (async () => {
			try {
				const rawMainGoals = onboarding && "mainGoals" in onboarding ? (onboarding as { mainGoals?: unknown }).mainGoals : null;
				const derivedMainGoals = Array.isArray(rawMainGoals)
					? (rawMainGoals as unknown[])
					: onboarding?.mainGoal
						? [onboarding.mainGoal]
						: [];

				const incomeAfterAllocations =
					typeof currentPlanData.incomeAfterAllocations === "number"
						? currentPlanData.incomeAfterAllocations
						: currentPlanData.totalIncome - (currentPlanData.totalAllocations ?? 0) - (currentPlanData.plannedDebtPayments ?? 0);
				const amountAfterExpenses = incomeAfterAllocations - (currentPlanData.totalExpenses ?? 0);
				const overLimitDebtCount = (debts ?? []).filter((d) => {
					const limit = typeof d.creditLimit === "number" ? d.creditLimit : 0;
					return limit > 0 && d.currentBalance > limit;
				}).length;
				const isOverBudget = amountAfterExpenses < 0 || overLimitDebtCount > 0;

				return await getAiBudgetTips({
					cacheKey: `dashboard:${budgetPlanId}:${currentPlanData.year}-${currentPlanData.monthNum}`,
					budgetPlanId,
					now,
					context: {
						username: username ?? null,
						onboarding: onboarding
							? {
								mainGoal: (onboarding.mainGoal as string | null | undefined) ?? null,
								mainGoals: derivedMainGoals as string[],
								occupation: (onboarding.occupation as string | null | undefined) ?? null,
								monthlySalary: onboarding.monthlySalary ? Number(onboarding.monthlySalary) : null,
								expenseOne: {
									name: (onboarding.expenseOneName as string | null | undefined) ?? null,
									amount: onboarding.expenseOneAmount ? Number(onboarding.expenseOneAmount) : null,
								},
								expenseTwo: {
									name: (onboarding.expenseTwoName as string | null | undefined) ?? null,
									amount: onboarding.expenseTwoAmount ? Number(onboarding.expenseTwoAmount) : null,
								},
								expenseThree: {
									name: (onboarding.expenseThreeName as string | null | undefined) ?? null,
									amount: onboarding.expenseThreeAmount ? Number(onboarding.expenseThreeAmount) : null,
								},
								expenseFour: {
									name: (onboarding.expenseFourName as string | null | undefined) ?? null,
									amount: onboarding.expenseFourAmount ? Number(onboarding.expenseFourAmount) : null,
								},
								hasAllowance: (onboarding.hasAllowance as boolean | null | undefined) ?? null,
								allowanceAmount: onboarding.allowanceAmount ? Number(onboarding.allowanceAmount) : null,
								hasDebtsToManage: (onboarding.hasDebtsToManage as boolean | null | undefined) ?? null,
								debtAmount: onboarding.debtAmount ? Number(onboarding.debtAmount) : null,
								debtNotes: (onboarding.debtNotes as string | null | undefined) ?? null,
							}
							: null,
						totalIncome: currentPlanData.totalIncome,
						totalAllocations: currentPlanData.totalAllocations,
						incomeAfterAllocations,
						totalExpenses: currentPlanData.totalExpenses,
						remaining: currentPlanData.remaining,
						amountAfterExpenses,
						isOverBudget,
						overLimitDebtCount,
						plannedDebtPayments: currentPlanData.plannedDebtPayments,
						plannedSavingsContribution: currentPlanData.plannedSavingsContribution,
						payDate,
						recap: expenseInsightsBase.recap,
						upcoming: expenseInsightsBase.upcoming,
						existingTips: expenseInsights.recapTips,
					},
					maxTips: 4,
				});
			} catch (err) {
				console.error("Dashboard: AI tips failed:", err);
				return null;
			}
		})();

		if (aiDashboardTips) {
			expenseInsights.recapTips = prioritizeRecapTips(aiDashboardTips, 4);
		}

		// Brand-new users may have no computed recap tips yet (and AI may be disabled in dev).
		// Always return a few onboarding-based starter tips so Home doesn't look empty.
		if (!expenseInsights.recapTips || expenseInsights.recapTips.length === 0) {
			expenseInsights.recapTips = getOnboardingStarterTips({
				onboarding: onboarding
					? {
						mainGoal: (onboarding.mainGoal as string | null | undefined) ?? null,
						mainGoals: (() => {
							const raw = onboarding && "mainGoals" in onboarding ? (onboarding as { mainGoals?: unknown }).mainGoals : null;
							if (Array.isArray(raw)) return raw as string[];
							return onboarding.mainGoal ? [String(onboarding.mainGoal)] : [];
						})(),
						occupation: (onboarding.occupation as string | null | undefined) ?? null,
						monthlySalary: onboarding.monthlySalary ? Number(onboarding.monthlySalary) : null,
						expenseOne: {
							name: (onboarding.expenseOneName as string | null | undefined) ?? null,
							amount: onboarding.expenseOneAmount ? Number(onboarding.expenseOneAmount) : null,
						},
						expenseTwo: {
							name: (onboarding.expenseTwoName as string | null | undefined) ?? null,
							amount: onboarding.expenseTwoAmount ? Number(onboarding.expenseTwoAmount) : null,
						},
					expenseThree: {
						name: (onboarding.expenseThreeName as string | null | undefined) ?? null,
						amount: onboarding.expenseThreeAmount ? Number(onboarding.expenseThreeAmount) : null,
					},
					expenseFour: {
						name: (onboarding.expenseFourName as string | null | undefined) ?? null,
						amount: onboarding.expenseFourAmount ? Number(onboarding.expenseFourAmount) : null,
					},
						hasAllowance: (onboarding.hasAllowance as boolean | null | undefined) ?? null,
						allowanceAmount: onboarding.allowanceAmount ? Number(onboarding.allowanceAmount) : null,
						hasDebtsToManage: (onboarding.hasDebtsToManage as boolean | null | undefined) ?? null,
						debtAmount: onboarding.debtAmount ? Number(onboarding.debtAmount) : null,
						debtNotes: (onboarding.debtNotes as string | null | undefined) ?? null,
					}
					: null,
				payDate,
				maxTips: 4,
			});
		}

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
				logoUrl:
					(d.sourceExpenseId ? debtLogoByExpenseId.get(d.sourceExpenseId) ?? null : null) ??
					resolveExpenseLogo(d.name).logoUrl,
				type: d.type,
				initialBalance: d.initialBalance,
				currentBalance: d.currentBalance,
				paidAmount: d.paidAmount,
				dueDay: d.dueDay ?? null,
				dueDate: d.dueDate ?? null,
				monthlyMinimum: d.monthlyMinimum ?? null,
				interestRate: d.interestRate ?? null,
				installmentMonths: d.installmentMonths ?? null,
				amount: d.amount ?? 0,
				creditLimit: d.creditLimit ?? null,
				sourceType: d.sourceType ?? null,
				// How much has already been paid against this debt this calendar month
				paidThisMonthAmount: currentMonthPaidByDebtId.get(d.id) ?? 0,
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
