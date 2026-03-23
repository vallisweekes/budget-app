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
import { getDashboardPayPeriodLabels } from "@/lib/helpers/dashboard/payPeriodLabels";
import { getAiBudgetTips } from "@/lib/ai/budgetTips";
import { prioritizeRecapTips } from "@/lib/expenses/insights";

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
		recapTips: prioritizeRecapTips([...(expenseInsightsBase.recapTips ?? []), ...multiPlanTips, ...debtTips], 6),
	};

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

	const aiDashboardTips = await (async () => {
		try {
			const loggedExpenseSignalKey = [
				expenseInsightsBase.loggedExpenseHabits.currentPeriod.count,
				Math.round(expenseInsightsBase.loggedExpenseHabits.currentPeriod.amount * 100),
				Math.round(expenseInsightsBase.loggedExpenseHabits.recentAverage.amount * 100),
				Math.round(totalDebtBalance * 100),
				recurringChargeCandidates.length,
			].join("-");
			return await getAiBudgetTips({
				cacheKey: `dashboard-web:${budgetPlanId}:${currentPlanData.year}-${currentPlanData.monthNum}:${Math.round(currentPlanData.totalExpenses * 100)}:${loggedExpenseSignalKey}`,
				budgetPlanId,
				now,
				context: {
					username: username ?? null,
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
			});
		} catch (err) {
			console.error("DashboardView: AI tips failed:", err);
			return null;
		}
	})();

	if (aiDashboardTips) {
		expenseInsights.recapTips = prioritizeRecapTips(aiDashboardTips, 4);
	}

	const { payPeriodLabel, previousPayPeriodLabel } = getDashboardPayPeriodLabels(now, payDate);

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
				payPeriodLabel={payPeriodLabel}
				previousPayPeriodLabel={previousPayPeriodLabel}
			/>
		</div>
	);
}
