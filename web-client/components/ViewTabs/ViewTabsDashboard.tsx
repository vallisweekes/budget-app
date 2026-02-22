"use client";

import PaymentInsightsCards from "@/components/Insights/PaymentInsightsCards";
import GoalsCard from "@/components/ViewTabs/GoalsCard";
import CategoryExpensesCard from "@/components/ViewTabs/CategoryExpensesCard";
import DashboardHeader from "@/components/ViewTabs/DashboardHeader";
import ExpenseDetailsSection from "@/components/ViewTabs/ExpenseDetailsSection";
import LargestExpensesCard from "@/components/ViewTabs/LargestExpensesCard";
import StatsGrid from "@/components/ViewTabs/StatsGrid";
import { useViewTabsDashboardModel } from "@/lib/hooks/useViewTabsDashboardModel";
import type { ViewTabsProps } from "@/types";

export default function ViewTabsDashboard(props: ViewTabsProps) {
	const {
		month,
		totalDebtBalance,
		expenseInsights,
		homepageGoalIds,
	} = props;

	const model = useViewTabsDashboardModel(props);

	return (
		<div className="dashboard-canvas-bg dashboard-dark-cards pb-6">
			<section className="dashboard-hero">
				<div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-4">
					<DashboardHeader
						month={month}
						expensesHref={model.expensesHref}
						incomeHref={model.incomeHref}
						shouldShowAddIncome={model.shouldShowAddIncome}
						hasIncome={model.combinedData.totalIncome > 0}
					/>

					<div className="mx-auto w-full max-w-[420px] sm:max-w-none">
						<StatsGrid
							amountLeftToBudget={model.combinedData.amountLeftToBudget}
							totalIncome={model.combinedData.totalIncome}
							totalAllocations={model.combinedData.totalAllocations}
							plannedDebtPayments={model.combinedData.plannedDebtPayments}
							totalExpenses={model.combinedData.totalExpenses}
							amountAfterExpenses={model.amountAfterExpenses}
							plannedSavingsContribution={model.combinedData.plannedSavingsContribution}
							savingsRate={model.savingsRate}
							spendRate={model.spendRate}
							avgSpendPerDay={model.avgSpendPerDay}
							daysInMonth={model.daysInMonth}
							incomeHref={model.incomeHref}
							shouldShowAddIncome={model.shouldShowAddIncome}
						/>
					</div>
				</div>
			</section>

			<div className="relative">
				<div aria-hidden className="dashboard-left-underlay" />
				<div className="dashboard-canvas-content pt-6 sm:pt-8 lg:pt-10 relative z-10">
					<div className="mx-auto w-full max-w-6xl px-4 space-y-4">
						<div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
							<CategoryExpensesCard
								topCategories={model.topCategories as any}
								expensesHref={model.expensesHref}
							/>
							<LargestExpensesCard
								model={model.largestExpensesCard}
								totalDebtBalance={totalDebtBalance}
								goalsCount={model.combinedData.goals.length}
							/>
						</div>

						<GoalsCard
							goals={model.combinedData.goals}
							homepageGoalIds={homepageGoalIds}
							plannedSavingsContribution={model.combinedData.plannedSavingsContribution}
							plannedEmergencyContribution={model.combinedData.plannedEmergencyContribution}
							plannedInvestments={model.combinedData.plannedInvestments}
							projectionHorizonYears={model.projectionHorizonYears}
						/>

						<PaymentInsightsCards
							recap={expenseInsights?.recap}
							recapTips={expenseInsights?.recapTips}
							upcoming={expenseInsights?.upcoming}
						/>

						<ExpenseDetailsSection
							show={model.showExpenseDetails}
							onToggle={() => model.setShowExpenseDetails((v) => !v)}
							pathname={model.pathname}
							month={month}
							budgetPlanId={props.budgetPlanId}
							resolvedActiveTab={model.resolvedActiveTab}
							activePlans={model.activePlans}
							allPlansData={props.allPlansData}
							fallbackPlanData={model.fallbackPlanData}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
