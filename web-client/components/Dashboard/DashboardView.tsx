import { getServerSession } from "next-auth/next";

import ViewTabs from "@/components/ViewTabs";
import { authOptions } from "@/lib/auth";
import { MONTHS } from "@/lib/constants/time";
import { currentMonthKey } from "@/lib/helpers/monthKey";
import { computeDebtTips } from "@/lib/debts/insights";
import { getDebtSummaryForPlan } from "@/lib/debts/summary";
import { getBudgetPlanMeta } from "@/lib/helpers/dashboard/getBudgetPlanMeta";
import { getDashboardPlanData } from "@/lib/helpers/dashboard/getDashboardPlanData";
import { getAllPlansDashboardData } from "@/lib/helpers/dashboard/getAllPlansDashboardData";
import { getIncomeMonthsCoverageByPlan } from "@/lib/helpers/dashboard/getIncomeMonthsCoverageByPlan";
import { getDashboardExpenseInsights } from "@/lib/helpers/dashboard/getDashboardExpenseInsights";
import { getLargestExpensesByPlan } from "@/lib/helpers/dashboard/getLargestExpensesByPlan";
import { getMultiPlanHealthTips } from "@/lib/helpers/dashboard/getMultiPlanHealthTips";
import { getAiBudgetTips } from "@/lib/ai/budgetTips";

export default async function DashboardView({ budgetPlanId }: { budgetPlanId: string }) {
	const now = new Date();
	const selectedYear = now.getFullYear();

	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	const userId = sessionUser?.id;

	const currentPlanData = await getDashboardPlanData(budgetPlanId, now);
	const month = MONTHS[currentPlanData.monthNum - 1] ?? currentMonthKey();

	const { payDate, homepageGoalIds } = await getBudgetPlanMeta(budgetPlanId);
	const expenseInsightsBase = await getDashboardExpenseInsights({ budgetPlanId, payDate, now, userId });

	const allPlansData = await getAllPlansDashboardData({
		budgetPlanId,
		currentPlanData,
		now,
		session,
		username,
	});

	const largestExpensesByPlan = await getLargestExpensesByPlan({
		planIds: Object.keys(allPlansData),
		now,
		perPlanLimit: 3,
	});

	const multiPlanTips = await getMultiPlanHealthTips({
		planIds: Object.keys(allPlansData),
		now,
		payDate,
		largestExpensesByPlan,
	});

	const incomeMonthsCoverageByPlan = await getIncomeMonthsCoverageByPlan({
		planIds: Object.keys(allPlansData),
		year: selectedYear,
	});

	const debtSummary = await getDebtSummaryForPlan(budgetPlanId, { includeExpenseDebts: true, ensureSynced: true });
	const debts = debtSummary.activeDebts;
	const debtTips = computeDebtTips({ debts, totalIncome: currentPlanData.totalIncome });
	const totalDebtBalance = debtSummary.totalDebtBalance;

	const expenseInsights = {
		...expenseInsightsBase,
		recapTips: [...(expenseInsightsBase.recapTips ?? []), ...multiPlanTips, ...debtTips],
	};

	const aiDashboardTips = await (async () => {
		try {
			return await getAiBudgetTips({
				cacheKey: `dashboard-web:${budgetPlanId}:${currentPlanData.year}-${currentPlanData.monthNum}`,
				budgetPlanId,
				now,
				context: {
					username: username ?? null,
					totalIncome: currentPlanData.totalIncome,
					totalExpenses: currentPlanData.totalExpenses,
					remaining: currentPlanData.remaining,
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
			console.error("DashboardView: AI tips failed:", err);
			return null;
		}
	})();

	if (aiDashboardTips) {
		expenseInsights.recapTips = aiDashboardTips;
	}

	return (
		<div className="min-h-screen pb-20 app-theme-bg">
			<ViewTabs
				budgetPlanId={budgetPlanId}
				month={month}
				categoryData={currentPlanData.categoryData}
				regularExpenses={[]}
				totalIncome={currentPlanData.totalIncome}
				totalAllocations={currentPlanData.totalAllocations}
				plannedDebtPayments={currentPlanData.plannedDebtPayments}
				plannedSavingsContribution={currentPlanData.plannedSavingsContribution}
				plannedEmergencyContribution={currentPlanData.plannedEmergencyContribution}
				plannedInvestments={currentPlanData.plannedInvestments}
				incomeAfterAllocations={currentPlanData.incomeAfterAllocations}
				totalExpenses={currentPlanData.totalExpenses}
				remaining={currentPlanData.remaining}
				debts={debts}
				totalDebtBalance={totalDebtBalance}
				goals={currentPlanData.goals}
				homepageGoalIds={homepageGoalIds}
				allPlansData={allPlansData}
				largestExpensesByPlan={largestExpensesByPlan}
				incomeMonthsCoverageByPlan={incomeMonthsCoverageByPlan}
				expenseInsights={expenseInsights}
			/>
		</div>
	);
}
