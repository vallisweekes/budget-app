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

export default function SettingsMain({
	isHidden,
	activeSection,
	onBack,
	budgetPlanId,
	settings,
	sessionUser,
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
				<BudgetSection
					budgetPlanId={budgetPlanId}
					settings={settings}
					monthSummary={monthSummary}
					fiftyThirtyTwenty={fiftyThirtyTwenty}
					selectedMonth={selectedMonth}
				/>
			) : null}
			{activeSection === "savings" ? <SavingsSection budgetPlanId={budgetPlanId} settings={settings} /> : null}
			{activeSection === "locale" ? <LocaleSection budgetPlanId={budgetPlanId} settings={settings} /> : null}
			{activeSection === "plans" ? (
				<PlansSection
					budgetPlanId={budgetPlanId}
					allPlans={allPlans ?? []}
					createBudgetPlanAction={createBudgetPlanAction}
				/>
			) : null}
			{activeSection === "notifications" ? <NotificationsSection /> : null}
			{activeSection === "danger" ? (
				<DangerSection budgetPlanId={budgetPlanId} allPlans={allPlans ?? []} />
			) : null}
		</main>
	);
}
