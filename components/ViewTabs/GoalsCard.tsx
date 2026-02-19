"use client";

import { useEffect, useMemo, useState } from "react";
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
	type ChartOptions,
	type ScriptableContext,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Card, InfoTooltip } from "@/components/Shared";
import Currency from "@/components/ViewTabs/Currency";
import { formatCurrencyCompact, formatCurrencyWhole } from "@/lib/helpers/currencyFormat";
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

	const savingsAssumptionNow = useMemo(() => {
		const n = Number(defaultMonthlySavings);
		return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
	}, [defaultMonthlySavings]);

	const emergencyAssumptionNow = useMemo(() => {
		const n = Number(defaultMonthlyEmergency);
		return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
	}, [defaultMonthlyEmergency]);

	const investmentsAssumptionNow = useMemo(() => {
		const n = Number(defaultMonthlyInvestments);
		return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
	}, [defaultMonthlyInvestments]);

	const [assumptions, setAssumptions] = useState<MonthlyAssumptions>({
		savings: savingsAssumptionNow,
		emergency: emergencyAssumptionNow,
		investments: investmentsAssumptionNow,
	});

	const [assumptionDraft, setAssumptionDraft] = useState<MonthlyAssumptionsDraft>({
		savings: String(savingsAssumptionNow),
		emergency: String(emergencyAssumptionNow),
		investments: String(investmentsAssumptionNow),
	});

	useEffect(() => {
		setAssumptions({ savings: savingsAssumptionNow, emergency: emergencyAssumptionNow, investments: investmentsAssumptionNow });
		setAssumptionDraft({
			savings: String(savingsAssumptionNow),
			emergency: String(emergencyAssumptionNow),
			investments: String(investmentsAssumptionNow),
		});
	}, [emergencyAssumptionNow, investmentsAssumptionNow, savingsAssumptionNow]);

	const goalsProjection = useMemo(() => {
		const monthlySavings = Math.max(0, assumptions.savings);
		const monthlyEmergency = Math.max(0, assumptions.emergency);
		const monthlyInvestments = Math.max(0, assumptions.investments);

		const startingSavings = goals
			.filter((g) => g.category === "savings")
			.reduce((sum, g) => sum + (g.currentAmount ?? 0), 0);
		const startingEmergency = goals
			.filter((g) => g.category === "emergency")
			.reduce((sum, g) => sum + (g.currentAmount ?? 0), 0);
		const startingInvestments = goals
			.filter((g) => g.category === "investment")
			.reduce((sum, g) => sum + (g.currentAmount ?? 0), 0);

		const monthsToProject = Math.max(1, Math.min(12 * projectionHorizonYears, 12 * 30));
		let savings = startingSavings;
		let emergency = startingEmergency;
		let investments = startingInvestments;

		const points: Array<{ t: number; savings: number; emergency: number; investments: number; total: number }> = [
			{ t: 0, savings, emergency, investments, total: savings + emergency + investments },
		];

		for (let i = 1; i <= monthsToProject; i += 1) {
			savings += monthlySavings;
			emergency += monthlyEmergency;
			investments += monthlyInvestments;
			points.push({ t: i, savings, emergency, investments, total: savings + emergency + investments });
		}

		return {
			startingSavings,
			startingEmergency,
			startingInvestments,
			monthlySavings,
			monthlyEmergency,
			monthlyInvestments,
			points,
		};
	}, [assumptions.emergency, assumptions.investments, assumptions.savings, goals, projectionHorizonYears]);

	const projectionChart = useMemo(() => {
		const pts = goalsProjection.points;
		if (pts.length < 2) return null;

		const baseYear = new Date().getFullYear();
		const savingsSeries = pts.map((p) => ({ x: p.t, y: p.savings }));
		const emergencySeries = pts.map((p) => ({ x: p.t, y: p.emergency }));
		const investmentsSeries = pts.map((p) => ({ x: p.t, y: p.investments }));

		const maxVal = Math.max(...pts.map((p) => Math.max(p.savings, p.emergency, p.investments)), 1);
		const suggestedMax = Math.ceil(maxVal / 1000) * 1000;

		const data = {
			datasets: [
				{
					label: "Savings",
					data: savingsSeries,
					borderColor: "rgba(52, 211, 153, 0.95)",
					backgroundColor: "rgba(52, 211, 153, 0.18)",
					fill: true,
					tension: 0.2,
					borderWidth: 4,
					pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === pts.length - 1 ? 4 : 0),
					pointHoverRadius: 5,
				},
				{
					label: "Emergency",
					data: emergencySeries,
					borderColor: "rgba(56, 189, 248, 0.95)",
					backgroundColor: "rgba(56, 189, 248, 0.14)",
					fill: true,
					tension: 0.2,
					borderWidth: 4,
					pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === pts.length - 1 ? 4 : 0),
					pointHoverRadius: 5,
				},
				{
					label: "Investments",
					data: investmentsSeries,
					borderColor: "rgba(167, 139, 250, 0.95)",
					backgroundColor: "rgba(167, 139, 250, 0.12)",
					fill: true,
					tension: 0.2,
					borderWidth: 4,
					pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === pts.length - 1 ? 4 : 0),
					pointHoverRadius: 5,
				},
			],
		};

		const options: ChartOptions<"line"> = {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					enabled: true,
					mode: "index",
					intersect: false,
					callbacks: {
						title: (items) => {
							const t = Number(items?.[0]?.parsed?.x ?? 0);
							if (t <= 0) return String(baseYear);
							const years = Math.floor(t / 12);
							const months = t % 12;
							if (years <= 0) return `+${t}m`;
							if (months === 0) return `+${years}y`;
							return `+${years}y ${months}m`;
						},
						label: (item) => `${item.dataset.label}: ${formatCurrencyWhole(item.parsed.y ?? 0)}`,
					},
				},
			},
			interaction: { mode: "index", intersect: false },
			scales: {
				x: {
					type: "linear",
					grid: { display: false },
					ticks: {
						color: "rgba(226, 232, 240, 0.6)",
						maxRotation: 0,
						minRotation: 0,
						autoSkip: true,
						stepSize: 12,
						maxTicksLimit: 7,
						autoSkipPadding: 28,
						callback: (val) => String(baseYear + Math.floor(Number(val) / 12)),
					},
				},
				y: {
					beginAtZero: true,
					suggestedMax,
					grid: { color: "rgba(255,255,255,0.10)" },
					ticks: {
						color: "rgba(226, 232, 240, 0.65)",
						callback: (val) => formatCurrencyCompact(Number(val)),
					},
				},
			},
		};

		return { data, options, maxVal: suggestedMax };
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

	const clearAssumptionZeroOnFocus = (field: keyof MonthlyAssumptionsDraft) => {
		setAssumptionDraft((prev) => {
			if (prev[field] !== "0") return prev;
			return { ...prev, [field]: "" };
		});
	};

	const normalizeAssumptionOnBlur = (field: keyof MonthlyAssumptionsDraft) => {
		setAssumptionDraft((prev) => {
			if (prev[field].trim() !== "") return prev;
			return { ...prev, [field]: "0" };
		});
	};

	const setAssumption = (field: keyof MonthlyAssumptionsDraft, raw: string) => {
		setAssumptionDraft((prev) => ({ ...prev, [field]: raw }));
		const next = raw.trim() === "" ? 0 : Number.parseInt(raw, 10);
		const value = Number.isFinite(next) ? Math.max(0, next) : 0;
		setAssumptions((prev) => ({ ...prev, [field]: value } as MonthlyAssumptions));
	};

	const resetProjectionAssumptionsToNow = () => {
		setAssumptions({ savings: savingsAssumptionNow, emergency: emergencyAssumptionNow, investments: investmentsAssumptionNow });
		setAssumptionDraft({
			savings: String(savingsAssumptionNow),
			emergency: String(emergencyAssumptionNow),
			investments: String(investmentsAssumptionNow),
		});
	};

	const canResetProjectionAssumptions =
		assumptions.savings !== savingsAssumptionNow ||
		assumptions.emergency !== emergencyAssumptionNow ||
		assumptions.investments !== investmentsAssumptionNow;

	if (!shouldShowGoalsCard) return null;

	return (
		<Card title={undefined}>
			<div className="space-y-3">
				<div className="inline-flex">
					<div className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900" style={{ backgroundColor: "#9EDBFF" }}>
						Goals
					</div>
				</div>

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
					<div className={`grid grid-cols-1 ${homepageGoalsForOverview.length === 1 ? "md:grid-cols-1" : "md:grid-cols-2"} gap-3`}>
						{homepageGoalsForOverview.map((g) => {
							const target = g.targetAmount ?? 0;
							const current = g.currentAmount ?? 0;
							const progress = target > 0 ? Math.min(1, current / target) : 0;
							return (
								<div key={g.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
									<div className="font-semibold text-white truncate">{g.title}</div>
									{target > 0 ? (
										<>
											<div className="mt-2 flex items-center justify-between text-sm text-slate-200">
												<span>
													<Currency value={current} />
												</span>
												<span>
													<Currency value={target} />
												</span>
											</div>
											<div className="mt-2 h-2 sm:h-4 rounded-full bg-white/10 overflow-hidden">
												<div
													className="h-2 sm:h-4 rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
													style={{ width: `${progress * 100}%` }}
												/>
											</div>
										</>
									) : (
										<div className="mt-2 text-sm text-slate-300">No target amount set</div>
									)}
									{g.targetYear ? <div className="mt-2 text-xs text-slate-400">Target year: {g.targetYear}</div> : null}
								</div>
							);
						})}
						{homepageGoalsForOverview.length === 0 ? (
							<div className="text-sm text-slate-300">Add a target amount to a goal to show it here.</div>
						) : null}
					</div>
				) : (
					<div className="space-y-3">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
							<Card
								title={
									<div className="inline-flex items-center gap-1.5">
										<span>Savings</span>
										<InfoTooltip
											ariaLabel="Savings projection info"
											content="Savings projection starts from your current Savings goal amount and adds your monthly Savings assumption each month."
										/>
									</div>
								}
								className="p-3 bg-white/5"
							>
								<div className="space-y-2">
									<div className="flex items-center justify-between gap-3">
										<div className="text-sm text-slate-300">Now</div>
										<div className="text-base font-bold text-white">{formatCurrencyWhole(goalsProjection.startingSavings)}</div>
									</div>
									<div>
										<div className="text-sm text-slate-300">Assumption</div>
										<div className="flex items-center gap-2">
											<input
												type="number"
												inputMode="numeric"
												min={0}
												step={50}
												value={assumptionDraft.savings}
												placeholder="0"
												onFocus={() => clearAssumptionZeroOnFocus("savings")}
												onBlur={() => normalizeAssumptionOnBlur("savings")}
												onChange={(e) => setAssumption("savings", e.target.value)}
												className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
												aria-label="Monthly savings assumption"
											/>
											<span className="text-xs text-slate-400 whitespace-nowrap">/ month</span>
										</div>
									</div>
								</div>
							</Card>

							<Card
								title={
									<div className="inline-flex items-center gap-1.5">
										<span>Emergency</span>
										<InfoTooltip
											ariaLabel="Emergency projection info"
											content="Emergency projection starts from your current Emergency fund goal amount and adds your monthly Emergency assumption each month."
										/>
									</div>
								}
								className="p-3 bg-white/5"
							>
								<div className="space-y-2">
									<div className="flex items-center justify-between gap-3">
										<div className="text-sm text-slate-300">Now</div>
										<div className="text-base font-bold text-white">{formatCurrencyWhole(goalsProjection.startingEmergency)}</div>
									</div>
									<div>
										<div className="text-sm text-slate-300">Assumption</div>
										<div className="flex items-center gap-2">
											<input
												type="number"
												inputMode="numeric"
												min={0}
												step={50}
												value={assumptionDraft.emergency}
												placeholder="0"
												onFocus={() => clearAssumptionZeroOnFocus("emergency")}
												onBlur={() => normalizeAssumptionOnBlur("emergency")}
												onChange={(e) => setAssumption("emergency", e.target.value)}
												className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
												aria-label="Monthly emergency assumption"
											/>
											<span className="text-xs text-slate-400 whitespace-nowrap">/ month</span>
										</div>
									</div>
								</div>
							</Card>

							<Card
								title={
									<div className="inline-flex items-center gap-1.5">
										<span>Investments</span>
										<InfoTooltip
											ariaLabel="Investments projection info"
											content="Investments projection starts from your current Investment goal amount and adds your monthly Investments assumption each month."
										/>
									</div>
								}
								className="p-3 bg-white/5"
							>
								<div className="space-y-2">
									<div className="flex items-center justify-between gap-3">
										<div className="text-sm text-slate-300">Now</div>
										<div className="text-base font-bold text-white">{formatCurrencyWhole(goalsProjection.startingInvestments)}</div>
									</div>
									<div>
										<div className="text-sm text-slate-300">Assumption</div>
										<div className="flex items-center gap-2">
											<input
												type="number"
												inputMode="numeric"
												min={0}
												step={50}
												value={assumptionDraft.investments}
												placeholder="0"
												onFocus={() => clearAssumptionZeroOnFocus("investments")}
												onBlur={() => normalizeAssumptionOnBlur("investments")}
												onChange={(e) => setAssumption("investments", e.target.value)}
												className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
												aria-label="Monthly investments assumption"
											/>
											<span className="text-xs text-slate-400 whitespace-nowrap">/ month</span>
										</div>
									</div>
								</div>
							</Card>
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
									Savings <span className="text-white">{formatCurrencyWhole(ptsLast(pts(goalsProjection)).savings)}</span>
									<span className="text-slate-500"> · </span>
									Emergency <span className="text-white">{formatCurrencyWhole(ptsLast(pts(goalsProjection)).emergency)}</span>
									<span className="text-slate-500"> · </span>
									Investments <span className="text-white">{formatCurrencyWhole(ptsLast(pts(goalsProjection)).investments)}</span>
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

function pts(projection: { points: Array<{ savings: number; emergency: number; investments: number }> }) {
	return projection.points;
}

function ptsLast(points: Array<{ savings: number; emergency: number; investments: number }>) {
	const last = points[points.length - 1] ?? { savings: 0, emergency: 0, investments: 0 };
	return last;
}
