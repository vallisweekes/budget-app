import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { bestEffortWithin } from "@/lib/bestEffortWithin";
import { getDashboardPlanDataForActivePayPeriod } from "@/lib/helpers/dashboard/getDashboardPlanData";
import { getBudgetPlanMeta } from "@/lib/helpers/dashboard/getBudgetPlanMeta";
import { listBudgetPlansForUser } from "@/lib/budgetPlans";
import { getAllDebts } from "@/lib/debts/store";
import { getDebtSummaryForPlan, type DebtSummary } from "@/lib/debts/summary";
import { computeDebtTips } from "@/lib/debts/insights";
import { getDashboardExpenseInsights } from "@/lib/helpers/dashboard/getDashboardExpenseInsights";
import { getAiBudgetTips } from "@/lib/ai/budgetTips";
import { localizeRecapTips } from "@/lib/ai/localizeRecapTips";
import { getOnboardingStarterTips } from "@/lib/ai/onboardingStarterTips";
import { prioritizeRecapTips } from "@/lib/expenses/insights";
import { getIncomeMonthsCoverageByPlan } from "@/lib/helpers/dashboard/getIncomeMonthsCoverageByPlan";
import { getLargestExpensesByPlan } from "@/lib/helpers/dashboard/getLargestExpensesByPlan";
import { getMultiPlanHealthTips } from "@/lib/helpers/dashboard/getMultiPlanHealthTips";
import { getAllPlansDashboardData } from "@/lib/helpers/dashboard/getAllPlansDashboardData";
import { getDashboardPayPeriodLabels } from "@/lib/helpers/dashboard/payPeriodLabels";
import { getIncomeMonthAnalysis } from "@/lib/helpers/finance/getIncomeMonthAnalysis";
import { syncDueDirectDebitExpenses } from "@/lib/expenses/directDebit";
import { resolveExpenseLogo } from "@/lib/expenses/logoResolver";
import { getExpensePaidMap } from "@/lib/expenses/paidSummary";
import { getJsonCache, setJsonCache } from "@/lib/cache/redisJsonCache";
import {
	DASHBOARD_CACHE_TTL_SECONDS,
	getDashboardCacheKey,
	logDerivedSummaryCacheEvent,
} from "@/lib/cache/dashboardCache";
import { prisma } from "@/lib/prisma";
import { supportsOnboardingCadenceFields as detectOnboardingCadenceFields, supportsOnboardingPayAnchorDateField } from "@/lib/prisma/capabilities";
import { isRedisConfigured } from "@/lib/redis";
import {
	buildPayPeriodFromMonthAnchor,
	getPayPeriodKeyForDate,
	getPayPeriodWindowFromPeriodKey,
	deriveBillFrequencyFromPayFrequency,
	normalizePayFrequency,
	resolveActivePayPeriodWindow,
} from "@/lib/payPeriods";

async function timeSection<T>(timings: string[], label: string, run: () => Promise<T>): Promise<T> {
	const startedAt = Date.now();
	try {
		return await run();
	} finally {
		timings.push(`${label};dur=${Date.now() - startedAt}`);
	}
	}

function buildTimingHeaders(params: {
	timings: string[];
	requestStartedAt: number;
	extra?: Record<string, string>;
}) {
	const totalMs = Date.now() - params.requestStartedAt;
	return {
		...(params.extra ?? {}),
		"server-timing": [...params.timings, `total;dur=${totalMs}`].join(", "),
		"x-dashboard-total-ms": String(totalMs),
	};
}

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function latestDate(...dates: Array<Date | null | undefined>): Date | null {
	const valid = dates.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
	if (valid.length === 0) return null;
	return valid.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
}

/**
 * GET /api/bff/dashboard?budgetPlanId=<optional>
 *
 * Returns the full server-computed dashboard payload.
 * This is the SAME data the web client's DashboardView computes server-side,
 * now available as a JSON API for the mobile client (or any external consumer).
 */
export async function GET(req: NextRequest) {
	const requestStartedAt = Date.now();
	const timings: string[] = [];
	try {
		const userId = await timeSection(timings, "auth", async () => getSessionUserId(req));
		if (!userId) return unauthorized();

		const { searchParams } = new URL(req.url);
		const budgetPlanId = await timeSection(timings, "plan_scope", async () => resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		}));
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

		const now = new Date();
		const directDebitSyncedExpenseIds = await timeSection(timings, "direct_debit_sync", async () => {
			const result = await bestEffortWithin(
				syncDueDirectDebitExpenses({ budgetPlanId, now }).catch((error) => {
					console.error("Dashboard: direct debit sync failed:", error);
					return [];
				}),
				800,
			);

			return Array.isArray(result) ? result : [];
		});
		const user = await timeSection(timings, "user", async () => prisma.user.findUnique({
			where: { id: userId },
			select: { name: true, createdAt: true },
		}));
		const username = user?.name ?? null;
		const budgetPlanLocale = await timeSection(timings, "plan_locale", async () => prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: { language: true, country: true },
		}));
		const dashboardLanguage = budgetPlanLocale?.language ?? "en";

		// 1) Plan meta (payDate, homepageGoalIds)
		// We need payDate early so the dashboard month matches the active pay period.
		const { payDate, homepageGoalIds, createdAt: planCreatedAt } = await timeSection(timings, "plan_meta", async () => getBudgetPlanMeta(budgetPlanId));
		const includeCadenceFields = await detectOnboardingCadenceFields();
		const includePayAnchorDate = await supportsOnboardingPayAnchorDateField();

		// Best-effort onboarding context: never let dashboard fail due to schema/client mismatch.
		const onboarding:
			| {
				status?: unknown;
				completedAt?: unknown;
				updatedAt?: unknown;
				mainGoal: unknown;
				mainGoals?: unknown;
				occupation: unknown;
				payFrequency?: unknown;
				billFrequency?: unknown;
				payAnchorDate?: unknown;
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
			| null = await timeSection(timings, "onboarding", async () => {
				try {
					return await prisma.userOnboardingProfile.findUnique({
						where: { userId },
						select: {
								status: true,
								completedAt: true,
								updatedAt: true,
							mainGoal: true,
							mainGoals: true,
							occupation: true,
							...(includeCadenceFields ? { payFrequency: true, billFrequency: true } : {}),
							...(includePayAnchorDate ? { payAnchorDate: true } : {}),
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
								status: true,
								completedAt: true,
								updatedAt: true,
								mainGoal: true,
								occupation: true,
								...(includeCadenceFields ? { payFrequency: true, billFrequency: true } : {}),
								...(includePayAnchorDate ? { payAnchorDate: true } : {}),
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
						return legacy
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
						return null;
					}
				}
			});

		const onboardingCompletedAtValue = onboarding?.completedAt;
		const onboardingUpdatedAtValue = onboarding?.updatedAt;
		const onboardingStatus = onboarding?.status;
		const onboardingPayFrequency = onboarding?.payFrequency;
		const onboardingPayAnchorDateValue = onboarding?.payAnchorDate;
		const onboardingCompletedAt = latestDate(
			onboardingCompletedAtValue instanceof Date ? onboardingCompletedAtValue : null,
			onboardingStatus === "completed" && onboardingUpdatedAtValue instanceof Date ? onboardingUpdatedAtValue : null,
		);
		const effectiveCreatedAt = latestDate(planCreatedAt, user?.createdAt ?? null, onboardingCompletedAt);

		// 2) Core plan data (income, expenses, allocations, goals, categories)
		// Compute using the ACTIVE pay-period window so totals match the period label.
		const payDay = typeof payDate === "number" && Number.isFinite(payDate) ? payDate : 1;
		const payFrequency = normalizePayFrequency(onboardingPayFrequency);
		const payAnchorDate = onboardingPayAnchorDateValue instanceof Date ? onboardingPayAnchorDateValue.toISOString() : null;
		const billFrequency = deriveBillFrequencyFromPayFrequency(payFrequency);
		const requestedMonthRaw = Number(searchParams.get("month"));
		const requestedYearRaw = Number(searchParams.get("year"));
		const includeExtendedData = String(searchParams.get("includeExtendedData") ?? "").toLowerCase() === "true";
		const hasRequestedAnchor = Number.isFinite(requestedMonthRaw)
			&& requestedMonthRaw >= 1
			&& requestedMonthRaw <= 12
			&& Number.isFinite(requestedYearRaw)
			&& requestedYearRaw >= 1900;
		const requestedAnchorMonth = hasRequestedAnchor ? Math.floor(requestedMonthRaw) : null;
		const requestedAnchorYear = hasRequestedAnchor ? Math.floor(requestedYearRaw) : null;
		const dashboardNow = (() => {
			if (requestedAnchorMonth == null || requestedAnchorYear == null) return now;
			const window = buildPayPeriodFromMonthAnchor({
				anchorMonth: requestedAnchorMonth,
				anchorYear: requestedAnchorYear,
				payDate: payDay,
				payFrequency,
				payAnchorDate,
			});
			const pointInWindow = new Date(window.start.getTime());
			pointInWindow.setUTCHours(12, 0, 0, 0);
			return pointInWindow;
		})();
		const selectedYear = dashboardNow.getFullYear();
		const activePayPeriodWindow = resolveActivePayPeriodWindow({
			now: dashboardNow,
			payDate: payDay,
			payFrequency,
			payAnchorDate,
			planCreatedAt: effectiveCreatedAt,
		});
		const dashboardCacheKey = getDashboardCacheKey({
			budgetPlanId,
			year: selectedYear,
			payDate: payDay,
			payFrequency,
			periodStart: activePayPeriodWindow.start,
			periodEnd: activePayPeriodWindow.end,
		}) + `:extended:${includeExtendedData ? "1" : "0"}`;
		const skipCache = directDebitSyncedExpenseIds.length > 0;
		if (!skipCache) {
			const cachedDashboard = await timeSection(timings, "cache_lookup", async () => getJsonCache<Record<string, unknown>>(dashboardCacheKey));
			if (cachedDashboard) {
				logDerivedSummaryCacheEvent({
					route: "dashboard",
					status: "hit",
					key: dashboardCacheKey,
					budgetPlanId,
				});
				return NextResponse.json(cachedDashboard, {
					headers: buildTimingHeaders({
						timings,
						requestStartedAt,
						extra: {
						"x-dashboard-cache": "hit",
						"x-dashboard-redis": isRedisConfigured() ? "configured" : "not-configured",
						},
					}),
				});
			}
		}
		logDerivedSummaryCacheEvent({
			route: "dashboard",
			status: "miss",
			key: dashboardCacheKey,
			budgetPlanId,
		});
		const currentPlanDataPromise = timeSection(timings, "current_plan", async () => getDashboardPlanDataForActivePayPeriod(budgetPlanId, {
			now: dashboardNow,
			payDate: payDay,
			payFrequency,
			payAnchorDate,
			planCreatedAt: effectiveCreatedAt,
			ensureDefaultCategories: false,
			skipDirectDebitSync: true,
		}));
		const payLabelsPromise = timeSection(timings, "pay_labels", async () =>
			Promise.resolve(
				getDashboardPayPeriodLabels(
					dashboardNow,
					payDay,
					payFrequency,
					payAnchorDate,
					effectiveCreatedAt,
				)
			)
		);

		const debtSummaryPromise = timeSection(timings, "debt_summary", async () => {
			const fallback = {
				regularDebts: [],
				expenseDebts: [],
				allDebts: [],
				activeDebts: [],
				activeRegularDebts: [],
				activeExpenseDebts: [],
				creditCards: [],
				liabilities: [],
				totalDebtBalance: 0,
				totalLiabilityBalance: 0,
			} satisfies DebtSummary;

			const buildLightweightDebtSummaryFallback = async (): Promise<DebtSummary> => {
				try {
					const allDebts = await bestEffortWithin(getAllDebts(budgetPlanId), 1200);
					if (!Array.isArray(allDebts) || allDebts.length === 0) {
						return fallback;
					}

					const regularDebts = allDebts.filter((d) => d.sourceType !== "expense");
					const expenseDebts = allDebts.filter((d) => d.sourceType === "expense");
					const activeDebts = allDebts.filter((d) => (d.currentBalance ?? 0) > 0);
					const activeRegularDebts = regularDebts.filter((d) => (d.currentBalance ?? 0) > 0);
					const activeExpenseDebts = expenseDebts.filter((d) => (d.currentBalance ?? 0) > 0);
					const creditCards = regularDebts.filter((d) => d.type === "credit_card" || d.type === "store_card");
					const totalDebtBalance = allDebts.reduce((sum, debt) => sum + Number(debt.currentBalance ?? 0), 0);

					return {
						regularDebts,
						expenseDebts,
						allDebts,
						activeDebts,
						activeRegularDebts,
						activeExpenseDebts,
						creditCards,
						liabilities: [],
						totalDebtBalance,
						totalLiabilityBalance: 0,
					};
				} catch (error) {
					console.error("Dashboard: lightweight debt fallback failed:", error);
					return fallback;
				}
			};

			try {
				const result = await bestEffortWithin(getDebtSummaryForPlan(budgetPlanId, {
					includeExpenseDebts: true,
					ensureSynced: false,
					recomputePaidAmounts: false,
				}), 1500);

				if (result && result.activeDebts.length > 0) {
					return result;
				}

				const lightweightFallback = await buildLightweightDebtSummaryFallback();
				if (lightweightFallback.activeDebts.length > 0) {
					return lightweightFallback;
				}

				return result ?? fallback;
			} catch (error) {
				console.error("Dashboard: debt summary failed:", error);
				return await buildLightweightDebtSummaryFallback();
			}
		});

		const expenseInsightsBasePromise = timeSection(timings, "expense_insights", async () => {
			const fallback = {
				recap: null,
				upcoming: [],
				recapTips: [],
				loggedExpenseHabits: {
					currentPeriod: { count: 0, amount: 0 },
					recentAverage: { months: 3, count: 0, amount: 0 },
					recentMonths: [],
					recurringMerchants: [],
					topCategories: [],
					paymentSources: [],
				},
			};

			try {
				const result = await bestEffortWithin(getDashboardExpenseInsights({
					budgetPlanId,
					payDate,
					payFrequency,
					payAnchorDate,
					now: dashboardNow,
					userId,
					planCreatedAt: effectiveCreatedAt,
				}), 5000);

				return result ?? fallback;
			} catch (error) {
				console.error("Dashboard: expense insights failed:", error);
				return fallback;
			}
		});

		const [currentPlanData, { payPeriodLabel, previousPayPeriodLabel }, debtSummary, expenseInsightsBase] = await Promise.all([
			currentPlanDataPromise,
			payLabelsPromise,
			debtSummaryPromise,
			expenseInsightsBasePromise,
		]);

		const additionalPlanIds = await timeSection(timings, "additional_plan_ids", async () => {
			try {
				const plans = await listBudgetPlansForUser({ userId });
				return plans
					.map((plan) => plan.id)
					.filter((planId) => planId !== budgetPlanId);
			} catch (error) {
				console.error("Dashboard: additional plan lookup failed:", error);
				return [] as string[];
			}
		});

		const additionalPlanSnapshots = await timeSection(timings, "additional_plan_snapshots", async () => {
			if (additionalPlanIds.length === 0) return [];

			try {
				return await Promise.all(
					additionalPlanIds.map(async (planId) => {
						return await getDashboardPlanDataForActivePayPeriod(planId, {
							now: dashboardNow,
							payDate: payDay,
							payFrequency,
							payAnchorDate,
							planCreatedAt: effectiveCreatedAt,
							ensureDefaultCategories: false,
							skipDirectDebitSync: true,
						});
					}),
				);
			} catch (error) {
				console.error("Dashboard: additional plan snapshots failed:", error);
				return [];
			}
		});

		const additionalPlanDebtSummaries = await timeSection(timings, "additional_plan_debts", async () => {
			if (additionalPlanIds.length === 0) return [] as DebtSummary[];

			try {
				const summaries = await Promise.all(
					additionalPlanIds.map(async (planId) => {
						const fallback: DebtSummary = {
							regularDebts: [],
							expenseDebts: [],
							allDebts: [],
							activeDebts: [],
							activeRegularDebts: [],
							activeExpenseDebts: [],
							creditCards: [],
							liabilities: [],
							totalDebtBalance: 0,
							totalLiabilityBalance: 0,
						};

						try {
							const result = await bestEffortWithin(getDebtSummaryForPlan(planId, {
								includeExpenseDebts: true,
								ensureSynced: false,
								recomputePaidAmounts: false,
							}), 1500);

							return result ?? fallback;
						} catch (error) {
							console.error("Dashboard: additional plan debt summary failed:", error);
							return fallback;
						}
					}),
				);

				return summaries;
			} catch (error) {
				console.error("Dashboard: additional plan debt summaries failed:", error);
				return [] as DebtSummary[];
			}
		});

		const additionalPlansExpenseTotal = additionalPlanSnapshots.reduce(
			(sum, snapshot) => sum + Number(snapshot.totalExpenses ?? 0),
			0,
		);
		const additionalPlansPlannedDebtTotal = additionalPlanSnapshots.reduce(
			(sum, snapshot) => sum + Number(snapshot.plannedDebtPayments ?? 0),
			0,
		);
		const additionalPlansDebtBalanceTotal = additionalPlanDebtSummaries.reduce(
			(sum, summary) => sum + Number(summary.totalDebtBalance ?? 0),
			0,
		);
		const additionalPlansActiveDebtCount = additionalPlanDebtSummaries.reduce(
			(sum, summary) => sum + Number(summary.activeDebts?.length ?? 0),
			0,
		);
		const combinedPlannedDebtPayments = Number(currentPlanData.plannedDebtPayments ?? 0) + additionalPlansPlannedDebtTotal;
		const baseIncomeAfterAllocations =
			typeof currentPlanData.incomeAfterAllocations === "number"
				? currentPlanData.incomeAfterAllocations
				: currentPlanData.totalIncome - (currentPlanData.totalAllocations ?? 0) - (currentPlanData.plannedDebtPayments ?? 0);
		const combinedAmountLeftToBudget = baseIncomeAfterAllocations - additionalPlansPlannedDebtTotal;

		const combinedTotalExpenses = (currentPlanData.totalExpenses ?? 0) + additionalPlansExpenseTotal;
		const combinedRemaining = combinedAmountLeftToBudget - combinedTotalExpenses;

		const incomeMonthAnalysis = await timeSection(timings, "income_month", async () => {
			try {
				const result = await bestEffortWithin(
					getIncomeMonthAnalysis({
						budgetPlanId,
						year: currentPlanData.year,
						month: currentPlanData.monthNum,
						payFrequency,
					}),
					2000,
				);
				return result ?? null;
			} catch (error) {
				console.error("Dashboard: income month analysis failed:", error);
				return null;
			}
		});
		const incomeLeftRightNow =
			typeof incomeMonthAnalysis?.moneyLeftAfterPlan === "number" && Number.isFinite(incomeMonthAnalysis.moneyLeftAfterPlan)
				? incomeMonthAnalysis.moneyLeftAfterPlan
				: typeof incomeMonthAnalysis?.incomeLeftRightNow === "number" && Number.isFinite(incomeMonthAnalysis.incomeLeftRightNow)
					? incomeMonthAnalysis.incomeLeftRightNow
				: null;

		const allPlansData = await timeSection(timings, "all_plans", async () => (async () => {
			if (!includeExtendedData) {
				return { [budgetPlanId]: currentPlanData };
			}

			try {
				return await getAllPlansDashboardData({
					budgetPlanId,
					currentPlanData,
					now: dashboardNow,
					userId,
					session: null,
					username,
				});
			} catch (error) {
				console.error("Dashboard: all plans data failed:", error);
				return { [budgetPlanId]: currentPlanData };
			}
		})());
		const planIds = Object.keys(allPlansData);

		const [largestExpensesByPlan, incomeMonthsCoverageByPlan] = await Promise.all([
			timeSection(timings, "largest_expenses", async () => (async () => {
				if (!includeExtendedData) {
					return {};
				}

				try {
					return await getLargestExpensesByPlan({
						planIds,
						now: dashboardNow,
						perPlanLimit: 3,
					});
				} catch (error) {
					console.error("Dashboard: largest expenses failed:", error);
					return {};
				}
			})()),
			timeSection(timings, "income_coverage", async () => (async () => {
				if (!includeExtendedData) {
					return {};
				}

				try {
					return await getIncomeMonthsCoverageByPlan({
						planIds,
						year: selectedYear,
					});
				} catch (error) {
					console.error("Dashboard: income coverage failed:", error);
					return {};
				}
			})()),
		]);

		const multiPlanTips = await timeSection(timings, "multi_plan_tips", async () => (async () => {
			if (!includeExtendedData) {
				return [];
			}

			try {
				return await getMultiPlanHealthTips({
					planIds,
					now: dashboardNow,
					payDate,
					largestExpensesByPlan,
				});
			} catch (error) {
				console.error("Dashboard: multi-plan tips failed:", error);
				return [];
			}
		})());

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
			await timeSection(timings, "debt_logos", async () => {
				try {
					const sourceExpenseRows = await bestEffortWithin(prisma.expense.findMany({
						where: { id: { in: sourceExpenseIds }, budgetPlanId },
						select: { id: true, logoUrl: true },
					}), 800);
					if (!Array.isArray(sourceExpenseRows)) return;
					for (const row of sourceExpenseRows) {
						if (typeof row.logoUrl === "string" && row.logoUrl.trim().length > 0) {
							debtLogoByExpenseId.set(row.id, row.logoUrl.trim());
						}
					}
				} catch (err) {
					console.error("Dashboard: debt logo lookup failed:", err);
				}
			});
		}

		// Query how much has been paid against each debt IN THE CURRENT PAY PERIOD
		// so we can exclude already-paid debts from "Upcoming Debts".
		const debtIds = debts.map((d) => d.id);
		const currentMonthPaidByDebtId = new Map<string, number>();
		if (debtIds.length > 0) {
			await timeSection(timings, "debt_payments", async () => {
				try {
					// Use paidAt timestamps bounded to the active pay-period window so
					// upcoming debt visibility reflects actual recorded payments in the
					// current period, even when historical rows have stale periodKey values.
					const periodKey = getPayPeriodKeyForDate({
						date: dashboardNow,
						payDate: payDay,
						payFrequency,
						payAnchorDate,
						planCreatedAt: effectiveCreatedAt,
					});
					const { start: periodStart, end: periodEnd } = getPayPeriodWindowFromPeriodKey({
						periodKey,
						payDate: payDay,
						payFrequency,
					});
					const periodStartAt = new Date(periodStart.getTime());
					periodStartAt.setHours(0, 0, 0, 0);
					const periodEndAt = new Date(periodEnd.getTime());
					periodEndAt.setHours(23, 59, 59, 999);

					const monthPayments = await bestEffortWithin(prisma.debtPayment.groupBy({
						by: ["debtId"],
						where: {
							debtId: { in: debtIds },
							paidAt: { gte: periodStartAt, lte: periodEndAt },
						},
						_sum: { amount: true },
					}), 1000);
					if (!Array.isArray(monthPayments)) return;
					for (const row of monthPayments) {
						const total = Number(row._sum.amount ?? 0);
						if (total > 0) currentMonthPaidByDebtId.set(row.debtId, total);
					}
				} catch (err) {
					console.error("Dashboard: debt month-payment query failed:", err);
				}
			});
		}

		const debtTips = (() => {
			try {
				return computeDebtTips({ debts, totalIncome: currentPlanData.totalIncome });
			} catch (error) {
				console.error("Dashboard: debt tips failed:", error);
				return [];
			}
		})();

		const activeDebtCount = debts.length + additionalPlansActiveDebtCount;
		const totalDebtBalance = Number(debtSummary.totalDebtBalance ?? 0) + additionalPlansDebtBalanceTotal;
		const totalLiabilityBalance = Number(debtSummary.totalLiabilityBalance ?? 0);

		const expenseInsights = {
			...expenseInsightsBase,
			recapTips: prioritizeRecapTips([
				...(expenseInsightsBase.recapTips ?? []),
				...multiPlanTips,
				...debtTips,
			], 6),
		};

		const aiDashboardTips = await timeSection(timings, "ai_tips", async () => (async () => {
			try {
				const rawMainGoals = onboarding && "mainGoals" in onboarding ? (onboarding as { mainGoals?: unknown }).mainGoals : null;
				const derivedMainGoals = Array.isArray(rawMainGoals)
					? (rawMainGoals as unknown[])
					: onboarding?.mainGoal
						? [onboarding.mainGoal]
						: [];

				const incomeAfterAllocations = combinedAmountLeftToBudget;
				const amountAfterExpenses = combinedRemaining;
				const overLimitDebtCount = (debts ?? []).filter((d) => {
					const limit = typeof d.creditLimit === "number" ? d.creditLimit : 0;
					return limit > 0 && d.currentBalance > limit;
				}).length;
				const isOverBudget = amountAfterExpenses < 0 || overLimitDebtCount > 0;
				const dueSoonDebtCount = (debts ?? []).filter((d) => {
					if (!d.dueDate) return false;
					const dueDate = new Date(d.dueDate);
					if (Number.isNaN(dueDate.getTime())) return false;
					const diffDays = Math.floor((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
					return diffDays >= 0 && diffDays < 7;
				}).length;
				const highestInterestDebt = (debts ?? []).reduce<typeof debts[number] | null>((best, debt) => {
					if (!Number.isFinite(debt.interestRate ?? Number.NaN)) return best;
					if (!best) return debt;
					return (debt.interestRate ?? 0) > (best.interestRate ?? 0) ? debt : best;
				}, null);
				const recurringChargeCandidates = Array.from(
					new Map(
						currentPlanData.categoryData
							.flatMap((category) => category.expenses ?? [])
							.filter((expense) => Boolean(expense?.isDirectDebit) && Number(expense?.amount ?? 0) > 0)
							.sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))
							.map((expense) => {
								const name = String(expense.name ?? "").trim();
								if (!name) return null;
								return [name.toLowerCase(), { name, amount: Number(expense.amount ?? 0) }] as const;
							})
							.filter((row): row is readonly [string, { name: string; amount: number }] => Boolean(row)),
					).values(),
				).slice(0, 4);
				const loggedExpenseSignalKey = [
					expenseInsightsBase.loggedExpenseHabits.currentPeriod.count,
					Math.round(expenseInsightsBase.loggedExpenseHabits.currentPeriod.amount * 100),
					Math.round(expenseInsightsBase.loggedExpenseHabits.recentAverage.amount * 100),
					Math.round(totalDebtBalance * 100),
					recurringChargeCandidates.length,
				].join("-");

				return await bestEffortWithin(getAiBudgetTips({
					cacheKey: `dashboard:${budgetPlanId}:${currentPlanData.year}-${currentPlanData.monthNum}:${Math.round(combinedTotalExpenses * 100)}:${loggedExpenseSignalKey}:${dashboardLanguage}`,
					budgetPlanId,
					now,
					language: dashboardLanguage,
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
						totalExpenses: combinedTotalExpenses,
						remaining: combinedRemaining,
						amountAfterExpenses,
						isOverBudget,
						overLimitDebtCount,
						plannedDebtPayments: currentPlanData.plannedDebtPayments,
						plannedSavingsContribution: currentPlanData.plannedSavingsContribution,
						payDate,
						recap: expenseInsightsBase.recap,
						upcoming: expenseInsightsBase.upcoming,
						loggedExpenseHabits: expenseInsightsBase.loggedExpenseHabits,
						subscriptionCandidates: recurringChargeCandidates,
						debtSnapshot: {
							totalBalance: totalDebtBalance,
							activeCount: debts.length,
							dueSoonCount: dueSoonDebtCount,
							highestInterestDebtName: highestInterestDebt?.name ?? null,
							highestInterestRate: highestInterestDebt?.interestRate ?? null,
						},
						existingTips: expenseInsights.recapTips,
					},
					maxTips: 4,
				}), 1800);
			} catch (err) {
				console.error("Dashboard: AI tips failed:", err);
				return null;
			}
		})());

		if (aiDashboardTips) {
			expenseInsights.recapTips = prioritizeRecapTips([
				...aiDashboardTips,
				...(expenseInsights.recapTips ?? []),
			], 6);
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
				budgetSnapshot: {
					totalIncome: currentPlanData.totalIncome,
					totalExpenses: combinedTotalExpenses,
					plannedExpenseCount: currentPlanData.categoryData.reduce(
						(count, category) => count + (category.expenses?.length ?? 0),
						0,
					),
				},
				payDate,
				maxTips: 4,
			});
		}

		expenseInsights.recapTips = localizeRecapTips(expenseInsights.recapTips, dashboardLanguage);

		// Derive paidTotal from expensePayment transaction records — single source of truth.
		const allExpenses = currentPlanData.categoryData.flatMap((category) => category.expenses ?? []);
		const dashboardPaidMap = await timeSection(timings, "paid_map", async () => getExpensePaidMap(
			allExpenses.map((e) => ({ id: String(e.id), amount: Number(e.amount ?? 0) })),
		));
		const paidTotal = allExpenses.reduce((sum, expense) => {
			const info = dashboardPaidMap.get(String(expense.id));
			return sum + (info?.paidAmount ?? 0);
		}, 0);
		const amountLeftToBudget = combinedAmountLeftToBudget;
		const amountAfterExpenses = combinedRemaining;
		const dashboardIncomeLeftRightNow = incomeLeftRightNow ?? amountAfterExpenses;
		const isOverBudgetBySpending = amountAfterExpenses < 0;
		const overLimitDebtCount = debts.filter((d) => {
			const limit = d.creditLimit ?? 0;
			if (!(limit > 0)) return false;
			return (d.currentBalance ?? 0) > limit;
		}).length;
		const hasOverLimitDebt = overLimitDebtCount > 0;
		const isOverBudget = isOverBudgetBySpending || hasOverLimitDebt;
		const totalBudget = amountLeftToBudget > 0 ? amountLeftToBudget : currentPlanData.totalIncome;

		const responseBody = {

			budgetPlanId,
			year: currentPlanData.year,
			monthNum: currentPlanData.monthNum,

			// Budget totals
			totalIncome: currentPlanData.totalIncome,
			totalExpenses: combinedTotalExpenses,
			remaining: combinedRemaining,

			// Allocations
			totalAllocations: currentPlanData.totalAllocations,
			plannedDebtPayments: combinedPlannedDebtPayments,
			plannedSavingsContribution: currentPlanData.plannedSavingsContribution,
			plannedEmergencyContribution: currentPlanData.plannedEmergencyContribution,
			plannedInvestments: currentPlanData.plannedInvestments,
			incomeAfterAllocations: currentPlanData.incomeAfterAllocations,

			// Categories with expense breakdowns — patch paid data from transaction records
			categoryData: currentPlanData.categoryData.map((cat) => ({
				...cat,
				expenses: (cat.expenses ?? []).map((exp) => {
					const info = dashboardPaidMap.get(String(exp.id));
					if (!info) return exp;
					return { ...exp, paid: info.isPaid, paidAmount: info.paidAmount };
				}),
			})),

			// Goals
			goals: currentPlanData.goals,
			homepageGoalIds,

			// Debts
			debts: debts.map((d) => ({
				id: d.id,
				name: d.name,
				logoUrl:
					(d.sourceExpenseId ? debtLogoByExpenseId.get(d.sourceExpenseId) : undefined) ??
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
			activeDebtCount,
			totalDebtBalance,
			totalLiabilityBalance,

			// Expense insights
			expenseInsights,

			// Multi-plan data
			allPlansData,
			largestExpensesByPlan,
			incomeMonthsCoverageByPlan,

			// Server-derived dashboard summary helpers (canonical for all clients)
			dashboardSummary: {
				amountLeftToBudget,
				amountAfterExpenses,
				incomeLeftRightNow: dashboardIncomeLeftRightNow,
				isOverBudgetBySpending,
				overLimitDebtCount,
				hasOverLimitDebt,
				isOverBudget,
				paidTotal,
				totalBudget,
			},

			// Meta
			payDate,
			payFrequency,
			billFrequency,
			payPeriodLabel,
			previousPayPeriodLabel,
		};

		await timeSection(timings, "cache_store", async () => setJsonCache(dashboardCacheKey, responseBody, DASHBOARD_CACHE_TTL_SECONDS));
		logDerivedSummaryCacheEvent({
			route: "dashboard",
			status: "store",
			key: dashboardCacheKey,
			budgetPlanId,
		});

		return NextResponse.json(responseBody, {
			headers: buildTimingHeaders({
				timings,
				requestStartedAt,
				extra: {
				"x-dashboard-cache": "miss",
				"x-dashboard-redis": isRedisConfigured() ? "configured" : "not-configured",
				},
			}),
		});
	} catch (error) {
		console.error("Failed to compute dashboard:", error);
		const isProd = process.env.NODE_ENV === "production";
		return NextResponse.json(
			{
				error: "Failed to compute dashboard data",
				...(isProd ? {} : { detail: error instanceof Error ? error.message : String(error) }),
			},
			{
				status: 500,
				headers: buildTimingHeaders({ timings, requestStartedAt }),
			}
		);
	}
}
