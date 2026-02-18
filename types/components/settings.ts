import type { ComponentType } from "react";
import type { Settings } from "@/lib/settings/store";
import type { MonthKey } from "@/types";

export type SettingsSectionId = "details" | "budget" | "savings" | "locale" | "plans" | "danger";

export type MonthSummary = {
	year: number;
	unallocated: number;
	incomeTotal: number;
	expenseTotal: number;
	debtPaymentsTotal: number;
	spendingTotal: number;
	plannedSavings: number;
	plannedEmergency: number;
	plannedInvestments: number;
};

export type FiftyThirtyTwentySummary = {
	needsTarget: number;
	needsActual: number;
	wantsTarget: number;
	wantsActual: number;
	savingsDebtTarget: number;
	savingsDebtActual: number;
};

export type ThemeKey = "nord-mint" | "calm-teal" | "midnight-peach" | "soft-light";

export type ThemeOption = { value: ThemeKey; label: string; description: string };

export type SettingsNavItem = {
	id: SettingsSectionId;
	title: string;
	description: string;
	icon: ComponentType<{ className?: string }>;
};

export type BudgetPlanListItem = { id: string; name: string; kind: string };

export interface SettingsContentProps {
	budgetPlanId: string;
	settings: Settings;
	sessionUser: { id?: string; name?: string | null; email?: string | null };
	monthSummary: MonthSummary | null;
	fiftyThirtyTwenty: FiftyThirtyTwentySummary | null;
	selectedMonth: MonthKey;
	allPlans?: BudgetPlanListItem[];
	createBudgetPlanAction?: (formData: FormData) => void;
}
