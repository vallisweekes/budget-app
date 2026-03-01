import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, InfoTooltip } from "@/components/Shared";
import Currency from "@/components/ViewTabs/Currency";
import { percent } from "@/lib/helpers/percent";

export default function StatsGrid(props: {
	amountLeftToBudget: number;
	totalIncome: number;
	totalAllocations: number;
	plannedDebtPayments: number;
	totalExpenses: number;
	amountAfterExpenses: number;
	overLimitDebtCount?: number;
	plannedSavingsContribution: number;
	savingsRate: number;
	spendRate: number;
	avgSpendPerDay: number;
	daysInMonth: number;
	incomeHref: string;
	shouldShowAddIncome: boolean;
}) {
	const {
		amountLeftToBudget,
		totalIncome,
		totalAllocations,
		plannedDebtPayments,
		totalExpenses,
		amountAfterExpenses,
		overLimitDebtCount,
		plannedSavingsContribution,
		savingsRate,
		spendRate,
		avgSpendPerDay,
		daysInMonth,
		incomeHref,
		shouldShowAddIncome,
	} = props;

	return (
		<div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
			<Card
				title={
					<span className="inline-flex items-center gap-1.5 text-base sm:text-sm">
						Income
						<InfoTooltip
							ariaLabel="Income info"
							content="Money left to budget for this month after your planned income sacrifice (allowance, savings contributions, emergency fund, investments) AND your planned debt payments are deducted. This is the pool you still need to assign to spending categories — not your gross income."
						/>
					</span>
				}
				className="p-2.5 sm:p-3"
			>
				<div className="flex items-center gap-2">
					<div className="text-lg sm:text-lg font-bold">
						<Currency value={amountLeftToBudget} />
					</div>
					{totalIncome > 0 && (
						<span
							className={`text-xs font-medium ${
								(totalAllocations + plannedDebtPayments) / totalIncome > 0.30 ? "text-red-400" : "text-emerald-400"
							}`}
						>
							{(totalAllocations + plannedDebtPayments) / totalIncome > 0.30 ? "↑" : "↓"} {percent((totalAllocations + plannedDebtPayments) / totalIncome)}
						</span>
					)}
				</div>
				<div className="mt-2">
					{shouldShowAddIncome ? (
						<Link
							href={incomeHref}
							className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/85 hover:text-white"
						>
							<Plus size={14} />
							Add income
						</Link>
					) : (
						<Link
							href={incomeHref}
							className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-white/85 hover:text-white"
						>
							<Plus size={14} />
							View income
						</Link>
					)}
				</div>
			</Card>

			<Card
				title={
					<span className="inline-flex items-center gap-1.5 text-base sm:text-sm">
						Expenses
						<InfoTooltip
							ariaLabel="Expenses info"
							content="Total expenses recorded for this month across your categories. This includes paid and unpaid items you’ve entered for the month, so it’s a good ‘what you’re actually spending’ number."
						/>
					</span>
				}
				className="p-2.5 sm:p-3"
			>
				<div className="flex items-center gap-2">
					<div className="text-lg sm:text-lg font-bold">
						<Currency value={totalExpenses} />
					</div>
					{totalIncome > 0 && (
						<span
							className={`text-xs font-medium ${
								spendRate > 0.70 ? "text-red-400" : spendRate > 0.50 ? "text-amber-400" : "text-emerald-400"
							}`}
						>
							{spendRate > 0.60 ? "↑" : "↓"} {percent(spendRate)}
						</span>
					)}
				</div>
			</Card>

			<Card
				title={
					<span className="inline-flex items-center gap-1.5 text-base sm:text-sm">
						Amount Left
						<InfoTooltip
							ariaLabel="Amount left info"
							content="What remains after expenses: (income left to budget after income sacrifice + debt plan) − (this month’s recorded expenses). If this goes negative, you’re overspending vs your plan."
						/>
					</span>
				}
				className="p-2.5 sm:p-3"
			>
				<div className="flex items-center gap-2">
					<div className={`text-lg sm:text-lg font-bold ${amountAfterExpenses < 0 ? "text-red-300" : "text-emerald-300"}`}>
						<Currency value={amountAfterExpenses} />
					</div>
					{amountLeftToBudget > 0 && (
						<span className={`text-xs font-medium ${amountAfterExpenses < 0 ? "text-red-400" : "text-emerald-400"}`}>
							{amountAfterExpenses < 0 ? "↓" : "↑"} {percent(Math.abs(amountAfterExpenses) / amountLeftToBudget)}
						</span>
					)}
				</div>
				{(overLimitDebtCount ?? 0) > 0 && (
					<div className="mt-2 text-xs font-semibold text-red-300">
						{overLimitDebtCount} card{overLimitDebtCount === 1 ? "" : "s"} over credit limit
					</div>
				)}
			</Card>

			<Card
				title={
					<span className="inline-flex items-center gap-1.5 text-base sm:text-sm">
						Savings
						<InfoTooltip
							ariaLabel="Savings info"
							content="Planned savings contribution coming from your Income sacrifice setup for this month. Think of this as ‘scheduled savings’ (what you intend to move/save), shown as an amount and a % of gross income."
						/>
					</span>
				}
				className="p-2.5 sm:p-3"
			>
				<div className="flex items-center gap-2">
					<div className="text-lg sm:text-lg font-bold text-emerald-300">
						<Currency value={plannedSavingsContribution ?? 0} />
					</div>
					{totalIncome > 0 && (
						<span className={`text-xs font-medium ${savingsRate > 0 ? "text-emerald-400" : "text-slate-400"}`}>
							{percent(savingsRate)}
						</span>
					)}
				</div>
			</Card>

			<Card
				title={
					<span className="inline-flex items-center gap-1.5 text-base sm:text-sm">
						Avg/day
						<InfoTooltip
							ariaLabel="Average per day info"
							content="Average spending per day: (this month’s expenses ÷ days in month). This helps you pace spending; the % compares your average daily spend to your daily budget based on the money left to budget."
						/>
					</span>
				}
				className="p-2.5 sm:p-3 col-span-2 lg:col-span-1"
			>
				<div className="flex items-center gap-2">
					<div className="text-lg sm:text-lg font-bold">
						<Currency value={avgSpendPerDay} />
					</div>
					{amountLeftToBudget > 0 && daysInMonth > 0 && (() => {
						const dailyBudget = amountLeftToBudget / daysInMonth;
						const spendRateDaily = dailyBudget > 0 ? avgSpendPerDay / dailyBudget : 0;
						const isOver = spendRateDaily > 1;
						const isHigh = spendRateDaily >= 0.9;
						return (
							<span className={`text-xs font-medium ${isOver || isHigh ? "text-red-400" : "text-emerald-400"}`}>
								{isOver ? "↑" : isHigh ? "↗" : "↓"} {percent(spendRateDaily)}
							</span>
						);
					})()}
				</div>
			</Card>
		</div>
	);
}
