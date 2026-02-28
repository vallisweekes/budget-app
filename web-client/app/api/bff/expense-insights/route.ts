import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getBudgetPlanMeta } from "@/lib/helpers/dashboard/getBudgetPlanMeta";
import { getDashboardExpenseInsights } from "@/lib/helpers/dashboard/getDashboardExpenseInsights";
import { getAiBudgetTips } from "@/lib/ai/budgetTips";
import { getOnboardingStarterTips } from "@/lib/ai/onboardingStarterTips";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/**
 * GET /api/bff/expense-insights?budgetPlanId=<optional>
 *
 * Returns computed expense insights:
 * - Previous month recap (paid/unpaid/partial breakdown)
 * - Upcoming payments with urgency levels
 * - Actionable tips
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
		const { payDate } = await getBudgetPlanMeta(budgetPlanId);

		// Best-effort onboarding context: never let insights fail due to schema/client mismatch.
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
			console.error("Expense insights: onboarding fetch failed:", error);
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
				console.error("Expense insights: onboarding legacy fetch failed:", legacyError);
				onboarding = null;
			}
		}

		const insights = await getDashboardExpenseInsights({
			budgetPlanId,
			payDate,
			now,
			userId,
		});

		const aiTips = await (async () => {
			try {
				const rawMainGoals = onboarding && "mainGoals" in onboarding ? (onboarding as { mainGoals?: unknown }).mainGoals : null;
				const derivedMainGoals = Array.isArray(rawMainGoals)
					? (rawMainGoals as unknown[])
					: onboarding?.mainGoal
						? [onboarding.mainGoal]
						: [];

				return await getAiBudgetTips({
					cacheKey: `expense-insights:${budgetPlanId}:${now.getFullYear()}-${now.getMonth() + 1}`,
					budgetPlanId,
					now,
					context: {
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
						payDate,
						recap: insights.recap,
						upcoming: insights.upcoming,
						existingTips: insights.recapTips,
					},
					maxTips: 4,
				});
			} catch (err) {
				console.error("Expense insights: AI tips failed:", err);
				return null;
			}
		})();

		const fallbackTips = getOnboardingStarterTips({
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

		const bestTips = (aiTips ?? insights.recapTips ?? []).slice(0, 4);

		return NextResponse.json({
			recap: insights.recap,
			upcoming: insights.upcoming,
			tips: bestTips.length ? bestTips : fallbackTips,
		});
	} catch (error) {
		console.error("Failed to compute expense insights:", error);
		return NextResponse.json(
			{ error: "Failed to compute expense insights" },
			{ status: 500 }
		);
	}
}
