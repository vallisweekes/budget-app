"use client";

import type { MonthKey } from "@/types";
import type { FiftyThirtyTwentySummary, MonthSummary } from "@/types/components";
import type { Settings } from "@/lib/settings/store";

import { usePayDateLabel } from "@/components/Admin/Settings/hooks/usePayDateLabel";
import HorizonCard from "@/components/Admin/Settings/sections/budget/HorizonCard";
import PayDateCard from "@/components/Admin/Settings/sections/budget/PayDateCard";
import StrategyCard from "@/components/Admin/Settings/sections/budget/StrategyCard";
import FiftyThirtyTwentySummaryCard from "@/components/Admin/Settings/sections/budget/FiftyThirtyTwentySummary";
import PayYourselfFirstSummary from "@/components/Admin/Settings/sections/budget/PayYourselfFirstSummary";
import ZeroBasedSummary from "@/components/Admin/Settings/sections/budget/ZeroBasedSummary";

export default function BudgetSection({
	budgetPlanId,
	settings,
	monthSummary,
	fiftyThirtyTwenty,
	selectedMonth,
}: {
	budgetPlanId: string;
	settings: Settings;
	monthSummary: MonthSummary | null;
	fiftyThirtyTwenty: FiftyThirtyTwentySummary | null;
	selectedMonth: MonthKey;
}) {
	const payDateLabel = usePayDateLabel(settings.payDate);

	return (
		<section className="space-y-6">
			<div className="flex items-center justify-between gap-4 mb-5">
				<div>
					<h2 className="text-2xl font-bold text-white">Budget</h2>
					<p className="text-slate-400 text-sm">Pay date, horizon, and budgeting style.</p>
				</div>
				<div className="flex items-center gap-2">
					<span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
						Core
					</span>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<PayDateCard budgetPlanId={budgetPlanId} payDate={settings.payDate} payDateLabel={payDateLabel} />
				<HorizonCard budgetPlanId={budgetPlanId} budgetHorizonYears={settings.budgetHorizonYears} />
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
				<StrategyCard budgetPlanId={budgetPlanId} budgetStrategy={settings.budgetStrategy} />

				{settings.budgetStrategy === "zeroBased" && monthSummary ? (
					<ZeroBasedSummary monthSummary={monthSummary} selectedMonth={selectedMonth} />
				) : null}

				{settings.budgetStrategy === "fiftyThirtyTwenty" && monthSummary && fiftyThirtyTwenty ? (
					<FiftyThirtyTwentySummaryCard
						budgetPlanId={budgetPlanId}
						monthSummary={monthSummary}
						fiftyThirtyTwenty={fiftyThirtyTwenty}
						selectedMonth={selectedMonth}
					/>
				) : null}

				{settings.budgetStrategy === "payYourselfFirst" && monthSummary ? (
					<PayYourselfFirstSummary monthSummary={monthSummary} selectedMonth={selectedMonth} />
				) : null}
			</div>
		</section>
	);
}
