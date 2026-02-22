"use client";

import { ArrowLeft } from "lucide-react";
import type { SettingsContentProps, SettingsSectionId } from "@/types/components";
import BudgetSection from "./sections/BudgetSection";
import DangerSection from "./sections/DangerSection";
import DetailsSection from "./sections/DetailsSection";
import LocaleSection from "./sections/LocaleSection";
import NotificationsSection from "./sections/NotificationsSection";
import PlansSection from "./sections/PlansSection";
import SavingsSection from "./sections/SavingsSection";

function PlanRequiredNotice({ title }: { title: string }) {
	return (
		<section className="space-y-4 sm:space-y-6">
			<div className="flex items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
				<div>
					<h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
					<p className="text-slate-400 text-xs sm:text-sm">Create a plan to edit these settings</p>
				</div>
			</div>
			<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 p-4 sm:p-8">
				<p className="text-sm text-slate-300">
					You don’t have any budget plans yet. Go to <span className="font-semibold text-white">Plans</span> to create one.
				</p>
			</div>
		</section>
	);
}

export default function SettingsMain({
	isHidden,
	activeSection,
	onBack,
	budgetPlanId,
	settings,
	sessionUser,
	cardDebts,
	monthSummary,
	fiftyThirtyTwenty,
	selectedMonth,
	allPlans,
	createBudgetPlanAction,
}: {
	isHidden: boolean;
	activeSection: SettingsSectionId;
	onBack: () => void;
} & SettingsContentProps) {
	return (
		<main
			className={`absolute inset-0 transition-all duration-300 ease-out transform-gpu overflow-y-auto pb-24 ${
				isHidden ? "opacity-0 translate-x-6 pointer-events-none" : "opacity-100 translate-x-0"
			}`}
		>
			<div className="pt-16 lg:pt-6 mb-4">
				<button
					type="button"
					onClick={onBack}
					className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white transition"
					aria-label="Back to settings"
				>
					<ArrowLeft className="w-4 h-4" />
					<span>Settings</span>
				</button>
			</div>

			{activeSection === "details" ? (
				<DetailsSection budgetPlanId={budgetPlanId} settings={settings} sessionUser={sessionUser} />
			) : null}
			{activeSection === "budget" ? (
				budgetPlanId ? (
					<BudgetSection
						budgetPlanId={budgetPlanId}
						settings={settings}
						monthSummary={monthSummary}
						fiftyThirtyTwenty={fiftyThirtyTwenty}
						selectedMonth={selectedMonth}
					/>
				) : (
					<PlanRequiredNotice title="Budget" />
				)
			) : null}
			{activeSection === "savings" ? (
				<SavingsSection budgetPlanId={budgetPlanId} settings={settings} cardDebts={cardDebts ?? []} />
			) : null}
			{activeSection === "locale" ? (
				<LocaleSection budgetPlanId={budgetPlanId} settings={settings} />
			) : null}
			{activeSection === "plans" ? (
				<PlansSection
					budgetPlanId={budgetPlanId}
					allPlans={allPlans ?? []}
					createBudgetPlanAction={createBudgetPlanAction}
				/>
			) : null}
			{activeSection === "notifications" ? <NotificationsSection /> : null}
			{activeSection === "danger" ? (
				budgetPlanId ? (
					<DangerSection budgetPlanId={budgetPlanId} allPlans={allPlans ?? []} />
				) : (
					<PlanRequiredNotice title="Danger Zone" />
				)
			) : null}
		</main>
	);
}
