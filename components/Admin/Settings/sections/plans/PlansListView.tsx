"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import PlanRow from "@/components/Admin/Settings/sections/plans/PlanRow";
import type { BudgetPlanListItem } from "@/types/components/settings";

export default function PlansListView({
	settingsBasePath,
	allPlans,
	budgetPlanId,
	planSettingsHref,
	hasPersonalPlan,
}: {
	settingsBasePath: string;
	allPlans: BudgetPlanListItem[];
	budgetPlanId: string;
	planSettingsHref: (planId: string) => string;
	hasPersonalPlan: boolean;
}) {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4 mb-5">
				<div>
					<h2 className="text-2xl font-bold text-white">Budget Plans</h2>
					<p className="text-slate-400 text-sm">Manage your budget plans</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
				<div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-950/15 p-4 sm:p-6">
					<div className="flex items-start justify-between gap-3">
						<div>
							<div className="text-sm font-semibold text-white">Your plans</div>
							<div className="mt-1 text-xs text-slate-400">Tap a plan to manage it in Settings.</div>
						</div>
						<span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-white/10">
							{allPlans.length} plan{allPlans.length === 1 ? "" : "s"}
						</span>
					</div>

					{allPlans.length === 0 ? (
						<div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/30 p-4 text-slate-300">
							<div className="text-sm font-semibold text-white">No budget plans yet</div>
							<div className="mt-1 text-sm text-slate-300">Create a plan to get started.</div>
							<div className="mt-4">
								<Link
									href={`${settingsBasePath}/plans/new?type=personal`}
									className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition"
								>
									<Plus className="h-4 w-4" />
									Create Personal plan
								</Link>
							</div>
						</div>
					) : (
						<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
							{allPlans.map((plan) => (
								<PlanRow
									key={plan.id}
									planSettingsHref={planSettingsHref}
									id={plan.id}
									name={plan.name}
									kind={plan.kind}
									isCurrent={plan.id === budgetPlanId}
								/>
							))}
						</div>
					)}
				</div>

				<div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-950/15 p-4 sm:p-6">
					<div className="flex items-start justify-between gap-3">
						<div>
							<div className="text-sm font-semibold text-white">Add another plan</div>
							<div className="mt-1 text-xs text-slate-400">Create extra plans for events like holidays and carnival.</div>
						</div>
						<span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-white/10">
							Optional
						</span>
					</div>

					{hasPersonalPlan ? (
						<div className="mt-4 space-y-2">
							<Link
								href={`${settingsBasePath}/plans/new?type=holiday`}
								className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
							>
								<Plus className="h-4 w-4" />
								Create Holiday plan
							</Link>
							<Link
								href={`${settingsBasePath}/plans/new?type=carnival`}
								className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
							>
								<Plus className="h-4 w-4" />
								Create Carnival plan
							</Link>
						</div>
					) : (
						<div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/30 p-4">
							<div className="text-sm font-semibold text-white">Create Personal first</div>
							<div className="mt-1 text-sm text-slate-300">
								Holiday and Carnival plans unlock after you create a Personal plan.
							</div>
							<div className="mt-4">
								<Link
									href={`${settingsBasePath}/plans/new?type=personal`}
									className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition"
								>
									<Plus className="h-4 w-4" />
									Create Personal plan
								</Link>
							</div>
						</div>
					)}

					{allPlans.length < 3 ? (
						<div className="mt-4 pt-4 border-t border-white/10">
							<Link
								href={`${settingsBasePath}/plans/new`}
								className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition"
							>
								<Plus className="h-4 w-4" />
								Create another budget
							</Link>
							<div className="mt-2 text-[11px] text-slate-400">Tip: use separate plans to keep event spending tidy.</div>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
