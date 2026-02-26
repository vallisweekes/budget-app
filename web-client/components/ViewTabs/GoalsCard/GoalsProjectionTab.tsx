import { Line } from "react-chartjs-2";

import type { MonthlyAssumptionsDraft } from "@/types";

import Currency from "@/components/ViewTabs/Currency";
import ProjectionAssumptionCard from "@/components/ViewTabs/GoalsCard/ProjectionAssumptionCard";
import { formatCurrencyWhole } from "@/lib/helpers/currencyFormat";
import type { GoalsProjection } from "@/lib/helpers/goalsProjection";
import type { GoalsProjectionChartConfig } from "@/lib/helpers/goalsProjectionChart";

export default function GoalsProjectionTab({
	goalsProjection,
	assumptionDraft,
	clearAssumptionZeroOnFocus,
	normalizeAssumptionOnBlur,
	setAssumption,
	projectionChart,
}: {
	goalsProjection: GoalsProjection;
	assumptionDraft: MonthlyAssumptionsDraft;
	clearAssumptionZeroOnFocus: (field: keyof MonthlyAssumptionsDraft) => void;
	normalizeAssumptionOnBlur: (field: keyof MonthlyAssumptionsDraft) => void;
	setAssumption: (field: keyof MonthlyAssumptionsDraft, raw: string) => void;
	projectionChart: GoalsProjectionChartConfig | null;
}) {
	const lastPoint = goalsProjection.points[goalsProjection.points.length - 1] ?? {
		savings: 0,
		emergency: 0,
		investments: 0,
		total: 0,
		t: 0,
	};

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
				<ProjectionAssumptionCard
					title="Savings"
					tooltip="Savings projection starts from your current Savings goal amount and adds your monthly Savings assumption each month."
					nowLabel={formatCurrencyWhole(goalsProjection.startingSavings)}
					value={assumptionDraft.savings}
					field="savings"
					clearZeroOnFocus={clearAssumptionZeroOnFocus}
					normalizeOnBlur={normalizeAssumptionOnBlur}
					setAssumption={setAssumption}
				/>
				<ProjectionAssumptionCard
					title="Emergency"
					tooltip="Emergency projection starts from your current Emergency fund goal amount and adds your monthly Emergency assumption each month."
					nowLabel={formatCurrencyWhole(goalsProjection.startingEmergency)}
					value={assumptionDraft.emergency}
					field="emergency"
					clearZeroOnFocus={clearAssumptionZeroOnFocus}
					normalizeOnBlur={normalizeAssumptionOnBlur}
					setAssumption={setAssumption}
				/>
				<ProjectionAssumptionCard
					title="Investments"
					tooltip="Investments projection starts from your current Investment goal amount and adds your monthly Investments assumption each month."
					nowLabel={formatCurrencyWhole(goalsProjection.startingInvestments)}
					value={assumptionDraft.investments}
					field="investments"
					clearZeroOnFocus={clearAssumptionZeroOnFocus}
					normalizeOnBlur={normalizeAssumptionOnBlur}
					setAssumption={setAssumption}
				/>
			</div>

			{projectionChart ? (
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
					<div className="flex items-center justify-between gap-3">
						<div className="text-sm font-semibold text-white">Over time</div>
						<div className="flex items-center gap-3 text-xs text-slate-300">
							<span className="inline-flex items-center gap-1">
								<span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Savings
							</span>
							<span className="inline-flex items-center gap-1">
								<span className="inline-block h-2 w-2 rounded-full bg-sky-400" /> Emergency
							</span>
							<span className="inline-flex items-center gap-1">
								<span className="inline-block h-2 w-2 rounded-full bg-violet-400" /> Investments
							</span>
						</div>
					</div>
					<div className="mt-2 text-xs text-slate-300">
						<span className="text-slate-400">End of horizon:</span>{" "}
						Savings <span className="text-white">{formatCurrencyWhole(lastPoint.savings)}</span>
						<span className="text-slate-500"> · </span>
						Emergency <span className="text-white">{formatCurrencyWhole(lastPoint.emergency)}</span>
						<span className="text-slate-500"> · </span>
						Investments <span className="text-white">{formatCurrencyWhole(lastPoint.investments)}</span>
					</div>
					<div className="mt-3 h-56 w-full">
						<Line data={projectionChart.data} options={projectionChart.options} />
					</div>
					<div className="mt-2 text-xs text-slate-400">
						Scale max: <Currency value={projectionChart.maxVal} />
					</div>
				</div>
			) : (
				<div className="text-sm text-slate-300">Add an assumption to see a projection.</div>
			)}
		</div>
	);
}
