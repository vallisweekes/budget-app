"use client";

import type { MonthKey } from "@/types";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	Tooltip,
	BarElement,
	Legend,
	type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

import IncomeManager from "@/components/Admin/Income/IncomeManager";
import { InfoTooltip } from "@/components/Shared";
import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import { formatCurrency } from "@/lib/helpers/money";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function IncomeMonthPageClient(props: {
	budgetPlanId: string;
	year: number;
	month: MonthKey;
	incomeItems: Array<{ id: string; name: string; amount: number }>;
	analysis: {
		grossIncome: number;
		plannedExpenses: number;
		plannedDebtPayments: number;
		plannedAllowances: number;
		plannedSetAside: number;
		incomeLeftToBudgetAfterSacrificeAndDebtPlan: number;
		remainingAfterRecordedExpenses: number;
		setAsideBreakdown: {
			fromAllocations: number;
			customTotal: number;
			customCount: number;
			isAllowanceOverride: boolean;
		};
		paidExpenses: number;
		paidDebtPaymentsFromIncome: number;
		remainingBills: number;
		moneyLeftAfterPlan: number;
	};
}) {
	const { budgetPlanId, year, month, incomeItems, analysis } = props;

	const plannedBillsTotal = (analysis.plannedExpenses ?? 0) + (analysis.plannedDebtPayments ?? 0);
	const billsPaidSoFar = (analysis.paidExpenses ?? 0) + (analysis.paidDebtPaymentsFromIncome ?? 0);
	// plannedSetAside already includes monthlyAllowance — do NOT add plannedAllowances again
	const plannedMoneyOutTotal = plannedBillsTotal + (analysis.plannedSetAside ?? 0);
	const moneyLeftAfterPaidBillsSoFar =
		(analysis.grossIncome ?? 0) - billsPaidSoFar - (analysis.plannedSetAside ?? 0);

	const allowanceLabel = "Allowance";
	const allowanceTooltip =
		`Your spending money for the month (not bills). ` +
		`For this month: ${formatCurrency(analysis.plannedAllowances ?? 0)}. ` +
		`${analysis.setAsideBreakdown?.isAllowanceOverride ? "This month is overridden. " : ""}` +
		"Edit it in Income → Allocations.";
	const incomeSacrificeLabel = "Income sacrifice";
	const incomeSacrificeTooltip =
		"Money set aside before spending: allowance + savings + emergency + investment + custom items for this month." +
		` (${analysis.setAsideBreakdown.customCount || 0} custom item(s), ${formatCurrency(analysis.setAsideBreakdown.customTotal || 0)}).`;
	const totalIncomeTooltip =
		"Total income added for this month. This does not reduce when you record bill payments — it’s your starting point.";
	const moneyLeftTooltip =
		"Money left = Income − (Expenses + Debts + Income sacrifice). Income sacrifice includes your allowance, savings, emergency, and investment contributions. " +
		`This month: ${formatCurrency(analysis.grossIncome ?? 0)} − (${formatCurrency(analysis.plannedExpenses ?? 0)} + ${formatCurrency(
			analysis.plannedDebtPayments ?? 0
		)} + ${formatCurrency(analysis.plannedSetAside ?? 0)})`;
	const paidSoFarTooltip =
		"Income left right now (so far) = Income − bills you've already paid − Income sacrifice (allowance + savings + emergency + investments). " +
		"When you record a payment, this usually goes down.";

	const chart = (() => {
		const labels = ["Money in", "Money out"];
		const data = {
			labels,
			datasets: [
				{
					label: "Income",
					data: [analysis.grossIncome ?? 0, 0],
					backgroundColor: "rgba(34, 197, 94, 0.18)",
					borderColor: "rgba(34, 197, 94, 0.85)",
					borderWidth: 1,
				},
				{
					label: "Bills (expenses)",
					data: [0, analysis.plannedExpenses ?? 0],
					backgroundColor: "rgba(248, 113, 113, 0.22)",
					borderColor: "rgba(248, 113, 113, 0.85)",
					borderWidth: 1,
				},
				{
					label: "Debt payments",
					data: [0, analysis.plannedDebtPayments ?? 0],
					backgroundColor: "rgba(251, 191, 36, 0.22)",
					borderColor: "rgba(251, 191, 36, 0.85)",
					borderWidth: 1,
				},
				{
					label: "Allowance",
					data: [0, analysis.plannedAllowances ?? 0],
					backgroundColor: "rgba(56, 189, 248, 0.20)",
					borderColor: "rgba(56, 189, 248, 0.85)",
					borderWidth: 1,
				},
				{
					label: "Income sacrifice",
					data: [0, analysis.plannedSetAside ?? 0],
					backgroundColor: "rgba(167, 139, 250, 0.18)",
					borderColor: "rgba(167, 139, 250, 0.75)",
					borderWidth: 1,
				},
			],
		};

		const options: ChartOptions<"bar"> = {
			responsive: true,
			maintainAspectRatio: false,
			indexAxis: "y",
			plugins: {
				legend: {
					display: true,
					labels: { color: "rgba(226, 232, 240, 0.85)", boxWidth: 10, boxHeight: 10 },
				},
				tooltip: {
					enabled: true,
					mode: "nearest",
					intersect: true,
					callbacks: {
						label: (item) => {
							const raw = Number(item.parsed.x ?? 0);
							return `${item.dataset.label}: ${formatCurrency(raw)}`;
						},
					},
				},
			},
			interaction: { mode: "nearest", intersect: true },
			scales: {
				x: {
					beginAtZero: true,
					stacked: true,
					grid: { color: "rgba(255,255,255,0.10)" },
					ticks: {
						color: "rgba(226, 232, 240, 0.65)",
						callback: (val) => formatCurrency(Number(val)),
					},
				},
				y: {
					stacked: true,
					grid: { display: false },
					ticks: { color: "rgba(226, 232, 240, 0.65)" },
				},
			},
		};

		return { data, options };
	})();

	return (
		<div className="space-y-4 sm:space-y-6">
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<div className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
					<div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400">
						<span>Total income</span>
						<InfoTooltip ariaLabel="Total income info" content={totalIncomeTooltip} className="-ml-0.5" />
					</div>
					<div className="mt-1 text-sm sm:text-base font-semibold text-white">{formatCurrency(analysis.grossIncome)}</div>
				</div>
				<div className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
					<div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400">
						<span>Expenses</span>
						<InfoTooltip
							ariaLabel="Expenses info"
							content="Bills you plan to pay this month (rent, subscriptions, etc)."
							className="-ml-0.5"
						/>
					</div>
					<div className="mt-1 text-sm sm:text-base font-semibold text-white">{formatCurrency(analysis.plannedExpenses)}</div>
				</div>
				<div className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
					<div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400">
						<span>Debts</span>
						<InfoTooltip
							ariaLabel="Debts info"
							content="Debt payments you plan to make from your income this month."
							className="-ml-0.5"
						/>
					</div>
					<div className="mt-1 text-sm sm:text-base font-semibold text-white">{formatCurrency(analysis.plannedDebtPayments)}</div>
				</div>
				<div className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
					<div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400">
						<span>{incomeSacrificeLabel}</span>
						<InfoTooltip
							ariaLabel="Income sacrifice info"
							content={incomeSacrificeTooltip}
							className="-ml-0.5"
						/>
					</div>
					<div className="mt-1 text-sm sm:text-base font-semibold text-white">{formatCurrency(analysis.plannedSetAside)}</div>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 sm:p-4">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400">
							<span>Money left</span>
							<InfoTooltip ariaLabel="Money left info" content={moneyLeftTooltip} className="-ml-0.5" />
						</div>
						<div
							className={`text-[10px] sm:text-xs font-semibold px-3 py-1 rounded-full border ${
								analysis.moneyLeftAfterPlan < 0
									? "border-red-400/30 bg-red-500/10 text-red-200"
									: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
							}`}
						>
							{analysis.moneyLeftAfterPlan < 0 ? "Over plan" : "On plan"}
						</div>
					</div>
					<div className={`mt-1 text-base sm:text-lg font-semibold ${analysis.moneyLeftAfterPlan < 0 ? "text-red-200" : "text-emerald-200"}`}>
						{formatCurrency(analysis.moneyLeftAfterPlan)}
					</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 sm:p-4">
					<div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400">
						<span>Income left right now</span>
						<InfoTooltip ariaLabel="Income left right now info" content={paidSoFarTooltip} className="-ml-0.5" />
					</div>
					<div className={`mt-1 text-base sm:text-lg font-semibold ${moneyLeftAfterPaidBillsSoFar < 0 ? "text-red-200" : "text-slate-200"}`}>
						{formatCurrency(moneyLeftAfterPaidBillsSoFar)}
					</div>

				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs text-slate-400">
				<div className="flex items-center gap-1.5">
					<span>{allowanceLabel}:</span>
					<span className="text-slate-200 font-semibold">{formatCurrency(analysis.plannedAllowances)}</span>
					<InfoTooltip ariaLabel="Allowances info" content={allowanceTooltip} className="-ml-0.5" />
				</div>
				<div className="flex items-center gap-1.5">
					<span>{incomeSacrificeLabel}:</span>
					<span className="text-slate-200 font-semibold">{formatCurrency(analysis.plannedSetAside)}</span>
					<InfoTooltip ariaLabel="Income sacrifice info" content={incomeSacrificeTooltip} className="-ml-0.5" />
				</div>
				<div>
					Money out total: <span className="text-slate-200 font-semibold">{formatCurrency(plannedMoneyOutTotal)}</span>
				</div>
			</div>

			<div className="space-y-2">
				<div className="h-56 w-full rounded-2xl border border-white/10 bg-slate-950/20 p-3 sm:p-4">
					<Bar data={chart.data} options={chart.options} />
				</div>
				<div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] sm:text-xs text-slate-400">
					<div>
						Bills planned: <span className="text-slate-200 font-semibold">{formatCurrency(plannedBillsTotal)}</span>
					</div>
					<div>
						Bills paid so far: <span className="text-slate-200 font-semibold">{formatCurrency(billsPaidSoFar)}</span>
					</div>
					<div>
						Bills remaining: <span className="text-slate-200 font-semibold">{formatCurrency(analysis.remainingBills)}</span>
					</div>
					<div>
						Sources: <span className="text-slate-200 font-semibold">{incomeItems.length}</span>
					</div>
				</div>

				{analysis.moneyLeftAfterPlan < 0 ? (
					<div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs sm:text-sm text-red-100">
						You’re overspending vs your plan (your plan spends more than you earn).
					</div>
				) : null}
			</div>

			<div className="rounded-2xl border border-white/10 bg-slate-900/30 backdrop-blur-xl p-4 sm:p-6 shadow-xl">
				<div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
					<div>
						<h2 className="text-lg sm:text-xl font-bold text-white">Income sources</h2>
						<p className="text-xs sm:text-sm text-slate-400 mt-1">Add, edit, or remove income for this month.</p>
					</div>
				</div>

				<IncomeManager
					budgetPlanId={budgetPlanId}
					year={year}
					month={month}
					incomeItems={incomeItems}
					onOpen={() => {}}
					onClose={() => {}}
				/>
			</div>
		</div>
	);
}
