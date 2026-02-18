import { getServerSession } from "next-auth/next";

import ViewTabs from "@/components/ViewTabs";
import { authOptions } from "@/lib/auth";
import { MONTHS } from "@/lib/constants/time";
import { currentMonthKey } from "@/lib/helpers/monthKey";
import { computeDebtTips } from "@/lib/debts/insights";
import { getAllDebts } from "@/lib/debts/store";
import { getBudgetPlanMeta } from "@/lib/helpers/dashboard/getBudgetPlanMeta";
import { getDashboardPlanData } from "@/lib/helpers/dashboard/getDashboardPlanData";
import { getAllPlansDashboardData } from "@/lib/helpers/dashboard/getAllPlansDashboardData";
import { getIncomeMonthsCoverageByPlan } from "@/lib/helpers/dashboard/getIncomeMonthsCoverageByPlan";
import { getDashboardExpenseInsights } from "@/lib/helpers/dashboard/getDashboardExpenseInsights";
import { getLargestExpensesByPlan } from "@/lib/helpers/dashboard/getLargestExpensesByPlan";

export default async function DashboardView({ budgetPlanId }: { budgetPlanId: string }) {
	const now = new Date();
	const selectedYear = now.getFullYear();

	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;

	const currentPlanData = await getDashboardPlanData(budgetPlanId, now);
	const month = MONTHS[currentPlanData.monthNum - 1] ?? currentMonthKey();

	const { payDate, homepageGoalIds } = await getBudgetPlanMeta(budgetPlanId);
	const expenseInsightsBase = await getDashboardExpenseInsights({ budgetPlanId, payDate, now });

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

	const incomeMonthsCoverageByPlan = await getIncomeMonthsCoverageByPlan({
		planIds: Object.keys(allPlansData),
		year: selectedYear,
	});

	const allDebts = await getAllDebts(budgetPlanId);
	const debts = allDebts.filter((d) => d.sourceType !== "expense");
	const debtTips = computeDebtTips({ debts, totalIncome: currentPlanData.totalIncome });
	const totalDebtBalance = debts.reduce((sum, debt) => sum + (debt.currentBalance || 0), 0);

	const expenseInsights = {
		...expenseInsightsBase,
		recapTips: [...(expenseInsightsBase.recapTips ?? []), ...debtTips],
	};

	return (
		<div className="min-h-screen pb-20 app-theme-bg">
			<div className="mx-auto w-full max-w-6xl px-4 py-6">
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
		</div>
	);
}
