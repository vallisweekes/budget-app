"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Tooltip,
	Filler,
	Legend,
} from "chart.js";
import { Card, InfoTooltip, PillLabel } from "@/components/Shared";
import GoalsOverviewTab from "@/components/ViewTabs/GoalsCard/GoalsOverviewTab";
import GoalsProjectionTab from "@/components/ViewTabs/GoalsCard/GoalsProjectionTab";
import { calculateGoalsProjection } from "@/lib/helpers/goalsProjection";
import { buildGoalsProjectionChart } from "@/lib/helpers/goalsProjectionChart";
import { formatCurrencyWhole } from "@/lib/helpers/currencyFormat";
import { useGoalsProjectionAssumptions } from "@/lib/hooks/useGoalsProjectionAssumptions";
import type { GoalLike, GoalsSubTabKey, MonthlyAssumptions, MonthlyAssumptionsDraft } from "@/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend);

export default function GoalsCard(props: {
	goals: GoalLike[];
	homepageGoalIds?: string[];
	plannedSavingsContribution: number;
	plannedEmergencyContribution: number;
	plannedInvestments: number;
	projectionHorizonYears: number;
}) {
	const { goals, homepageGoalIds: initialHomepageGoalIds, plannedSavingsContribution, plannedEmergencyContribution, plannedInvestments, projectionHorizonYears } =
		props;

	const [goalsSubTab, setGoalsSubTab] = useState<GoalsSubTabKey>("overview");

	const homepageGoalIds = useMemo(
		() => (Array.isArray(initialHomepageGoalIds) ? initialHomepageGoalIds.slice(0, 2) : []),
		[initialHomepageGoalIds]
	);

	const defaultMonthlySavings = plannedSavingsContribution ?? 0;
	const defaultMonthlyEmergency = plannedEmergencyContribution ?? 0;
	const defaultMonthlyInvestments = plannedInvestments ?? 0;

	const {
		assumptions,
		assumptionDraft,
		setAssumption,
		clearAssumptionZeroOnFocus,
		normalizeAssumptionOnBlur,
		resetProjectionAssumptionsToNow,
		canResetProjectionAssumptions,
	} = useGoalsProjectionAssumptions({
		defaultMonthlySavings,
		defaultMonthlyEmergency,
		defaultMonthlyInvestments,
	});

	const goalsProjection = useMemo(
		() => calculateGoalsProjection({ goals, assumptions: assumptions as MonthlyAssumptions, projectionHorizonYears }),
		[assumptions, goals, projectionHorizonYears]
	);

	const projectionChart = useMemo(() => {
		return buildGoalsProjectionChart({ points: goalsProjection.points, baseYear: new Date().getFullYear() });
	}, [goalsProjection.points]);

	const eligibleHomepageGoals = useMemo(() => goals, [goals]);

	const homepageGoalsForOverview = useMemo(() => {
		const byId = new Map<string, GoalLike>();
		eligibleHomepageGoals.forEach((g) => byId.set(g.id, g));

		const picked = homepageGoalIds
			.filter((id) => byId.has(id))
			.map((id) => byId.get(id)!)
			.slice(0, 2);
		if (picked.length > 0) return picked;

		const emergency = eligibleHomepageGoals.find((g) => g.category === "emergency");
		const savings = eligibleHomepageGoals.find((g) => g.category === "savings");
		const defaults: GoalLike[] = [];
		if (emergency) defaults.push(emergency);
		if (savings && savings.id !== emergency?.id) defaults.push(savings);
		if (defaults.length > 0) return defaults.slice(0, 2);
		return eligibleHomepageGoals.slice(0, 2);
	}, [eligibleHomepageGoals, homepageGoalIds]);

	const shouldShowGoalsCard = useMemo(() => {
		const hasGoals = goals.length > 0;
		const hasProjectionSignal =
			goalsProjection.startingSavings > 0 ||
			goalsProjection.startingEmergency > 0 ||
			goalsProjection.startingInvestments > 0 ||
			goalsProjection.monthlySavings > 0 ||
			goalsProjection.monthlyEmergency > 0 ||
			goalsProjection.monthlyInvestments > 0;
		return hasGoals || hasProjectionSignal;
	}, [goals.length, goalsProjection]);

	if (!shouldShowGoalsCard) return null;

	return (
		<Card title={undefined}>
			<div className="space-y-3">
				<PillLabel>Goals</PillLabel>

				<div className="flex items-center justify-between gap-3">
					<div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
						<button
							type="button"
							onClick={() => setGoalsSubTab("overview")}
							className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
								goalsSubTab === "overview" ? "bg-white text-slate-900" : "text-slate-200 hover:text-white"
							}`}
						>
							Overview
						</button>
						<button
							type="button"
							onClick={() => setGoalsSubTab("projection")}
							className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
								goalsSubTab === "projection" ? "bg-white text-slate-900" : "text-slate-200 hover:text-white"
							}`}
						>
							Projection
						</button>
					</div>

					<div className="inline-flex items-center gap-2">
						{goalsSubTab === "projection" ? (
							<button
								type="button"
								onClick={resetProjectionAssumptionsToNow}
								disabled={!canResetProjectionAssumptions}
								className={`rounded-full px-3 py-1 text-xs font-semibold transition border ${
									canResetProjectionAssumptions
										? "border-white/15 bg-white/10 text-white hover:bg-white/15"
										: "border-white/10 bg-white/5 text-white/50 cursor-not-allowed"
								}`}
								aria-label="Reset projection assumptions to now"
								title="Reset Savings/Emergency assumptions back to your current plan values"
							>
								Reset to now
							</button>
						) : null}

						<div className="text-xs text-slate-400 inline-flex items-center gap-1.5">
							<span>{projectionHorizonYears}y</span>
							<InfoTooltip
								ariaLabel="Projection info"
								content="Projection uses your monthly assumptions for Savings/Emergency/Investments (per month) starting from the current month."
							/>
						</div>
					</div>
				</div>

				{goalsSubTab === "overview" ? (
					<GoalsOverviewTab goals={homepageGoalsForOverview} />
				) : (
					<GoalsProjectionTab
						goalsProjection={goalsProjection}
						assumptionDraft={assumptionDraft as MonthlyAssumptionsDraft}
						clearAssumptionZeroOnFocus={clearAssumptionZeroOnFocus}
						normalizeAssumptionOnBlur={normalizeAssumptionOnBlur}
						setAssumption={setAssumption}
						projectionChart={projectionChart}
					/>
				)}

				<div className="flex justify-end">
					<Link href="/admin/goals" className="text-sm font-medium text-white/90 hover:text-white">
						Goals Overview
					</Link>
				</div>
			</div>
		</Card>
	);
}
