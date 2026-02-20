"use client";

import type { MonthKey } from "@/types";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Tooltip,
	Filler,
	Legend,
	type ChartOptions,
	type ScriptableContext,
} from "chart.js";
import { Line } from "react-chartjs-2";

import IncomeManager from "@/components/Admin/Income/IncomeManager";
import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import { formatCurrency } from "@/lib/helpers/money";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend);

export default function IncomeMonthPageClient(props: {
	budgetPlanId: string;
	year: number;
	month: MonthKey;
	incomeItems: Array<{ id: string; name: string; amount: number }>;
	yearSeries: {
		monthKeys: MonthKey[];
		incomeStacks: Array<{ label: string; data: number[]; borderColor: string; backgroundColor: string }>;
		incomeTotalsByMonth: number[];
		plannedExpensesByMonth: number[];
		paidExpensesByMonth: number[];
	};
	analysis: {
		grossIncome: number;
		plannedExpenses: number;
		paidExpenses: number;
		remainingExpenses: number;
		netPlanned: number;
		netPaid: number;
	};
}) {
	const { budgetPlanId, year, month, incomeItems, analysis, yearSeries } = props;

	const selectedMonthIndex = Math.max(0, yearSeries.monthKeys.findIndex((m) => m === month));
	const labels = yearSeries.monthKeys.map((m) => formatMonthKeyLabel(m));
	const plannedExpensesSeries = yearSeries.plannedExpensesByMonth ?? [];
	const paidExpensesSeries = yearSeries.paidExpensesByMonth ?? [];
	const incomeTotalsSeries = yearSeries.incomeTotalsByMonth ?? [];
	const netPlannedSeries = labels.map((_, idx) => (incomeTotalsSeries[idx] ?? 0) - (plannedExpensesSeries[idx] ?? 0));

	const chart = (() => {
		const incomeStackDatasets = (yearSeries.incomeStacks ?? []).map((s) => ({
			label: s.label,
			data: (s.data ?? []).map((y, idx) => ({ x: idx, y })),
			borderColor: s.borderColor,
			backgroundColor: s.backgroundColor,
			fill: true,
			tension: 0.25,
			borderWidth: 3,
			stack: "income",
			pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === selectedMonthIndex ? 4 : 0),
			pointHoverRadius: 5,
		}));

		const expenseDataset = {
			label: "Planned expenses",
			data: plannedExpensesSeries.map((y, idx) => ({ x: idx, y })),
			borderColor: "rgba(248, 113, 113, 0.95)",
			backgroundColor: "rgba(248, 113, 113, 0.10)",
			fill: false,
			tension: 0.25,
			borderWidth: 3,
			stack: "expenses",
			pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === selectedMonthIndex ? 4 : 0),
			pointHoverRadius: 5,
		};

		const paidExpenseDataset = {
			label: "Paid expenses",
			data: paidExpensesSeries.map((y, idx) => ({ x: idx, y })),
			borderColor: "rgba(168, 85, 247, 0.85)",
			backgroundColor: "rgba(168, 85, 247, 0.08)",
			fill: false,
			tension: 0.25,
			borderWidth: 2,
			borderDash: [6, 6],
			stack: "expenses",
			pointRadius: 0,
			pointHoverRadius: 4,
		};

		const netDataset = {
			label: "Net (income - planned)",
			data: netPlannedSeries.map((y, idx) => ({ x: idx, y })),
			borderColor: analysis.netPlanned < 0 ? "rgba(251, 113, 133, 0.9)" : "rgba(34, 197, 94, 0.85)",
			backgroundColor: "rgba(34, 197, 94, 0.00)",
			fill: false,
			tension: 0.25,
			borderWidth: 2,
			borderDash: [2, 6],
			stack: "net",
			pointRadius: 0,
			pointHoverRadius: 4,
		};

		const data = {
			datasets: [...incomeStackDatasets, expenseDataset, paidExpenseDataset, netDataset],
		};

		const options: ChartOptions<"line"> = {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: true,
					labels: { color: "rgba(226, 232, 240, 0.85)", boxWidth: 10, boxHeight: 10 },
				},
				tooltip: {
					enabled: true,
					mode: "index",
					intersect: false,
					callbacks: {
						title: (items) => labels[Number(items?.[0]?.parsed?.x ?? 0)] ?? "",
						label: (item) => `${item.dataset.label}: ${formatCurrency(item.parsed.y ?? 0)}`,
					},
				},
			},
			interaction: { mode: "index", intersect: false },
			scales: {
				x: {
					type: "linear",
					grid: { display: false },
					ticks: {
						color: "rgba(226, 232, 240, 0.65)",
						maxRotation: 0,
						minRotation: 0,
						autoSkip: true,
						maxTicksLimit: 6,
						callback: (val) => labels[Number(val)] ?? "",
					},
				},
				y: {
					beginAtZero: true,
					stacked: true,
					grid: { color: "rgba(255,255,255,0.10)" },
					ticks: {
						color: "rgba(226, 232, 240, 0.65)",
						callback: (val) => formatCurrency(Number(val)),
					},
				},
			},
		};

		return { data, options };
	})();

	return (
		<div className="space-y-4 sm:space-y-6">
			<div className="rounded-2xl border border-white/10 bg-slate-900/30 backdrop-blur-xl p-4 sm:p-6 shadow-xl">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2 className="text-lg sm:text-xl font-bold text-white">Income analysis</h2>
						<p className="text-xs sm:text-sm text-slate-400 mt-1">
							{formatMonthKeyLabel(month)} {year} — income vs expenses
						</p>
					</div>
					<div
						className={`text-xs sm:text-sm font-semibold px-3 py-1 rounded-full border ${
							analysis.netPlanned < 0
								? "border-red-400/30 bg-red-500/10 text-red-200"
								: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
						}`}
					>
						Net: {formatCurrency(analysis.netPlanned)}
					</div>
				</div>

				<div className="mt-4 space-y-3">
					<div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 sm:p-4">
						<div className="flex items-center justify-between gap-3">
							<div className="text-xs sm:text-sm font-semibold text-white">Year trend</div>
							<div className="text-[10px] sm:text-xs text-slate-400">Stacked income sources + expenses</div>
						</div>
						<div className="mt-3 h-56 w-full">
							<Line data={chart.data} options={chart.options} />
						</div>
					</div>

					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
						<div className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
							<div className="text-[10px] sm:text-xs text-slate-400">Paid expenses</div>
							<div className="mt-1 text-sm sm:text-base font-semibold text-white">{formatCurrency(analysis.paidExpenses)}</div>
						</div>
						<div className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
							<div className="text-[10px] sm:text-xs text-slate-400">Remaining expenses</div>
							<div className="mt-1 text-sm sm:text-base font-semibold text-white">{formatCurrency(analysis.remainingExpenses)}</div>
						</div>
						<div className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
							<div className="text-[10px] sm:text-xs text-slate-400">Net (paid)</div>
							<div className={`mt-1 text-sm sm:text-base font-semibold ${analysis.netPaid < 0 ? "text-red-200" : "text-emerald-200"}`}
							>
								{formatCurrency(analysis.netPaid)}
							</div>
						</div>
						<div className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
							<div className="text-[10px] sm:text-xs text-slate-400">Sources</div>
							<div className="mt-1 text-sm sm:text-base font-semibold text-white">{incomeItems.length}</div>
						</div>
					</div>

					{analysis.netPlanned < 0 ? (
						<div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs sm:text-sm text-red-100">
							Planned expenses exceed income for this month.
						</div>
					) : null}
				</div>
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
