import { Ionicons } from "@expo/vector-icons";

import type { OnboardingGoal, OnboardingProfile } from "@/lib/apiTypes";
import { T } from "@/lib/theme";

import type { VisibleGoal } from "@/screens/onboarding/types";

export const DEFAULT_VISIBLE_GOALS: VisibleGoal[] = ["improve_savings"];
export const EXPENSES_TOTAL_BLUE = "#2a0a9e";

export const ICON_COLORS = {
  emergency_fund: T.orange,
  improve_savings: T.green,
  investments: EXPENSES_TOTAL_BLUE,
} satisfies Record<VisibleGoal, string>;

export const STEP_ICON_COLORS = {
  0: T.orange,
  1: T.onAccent,
  2: T.green,
  3: T.onAccent,
  4: T.orange,
  5: T.red,
} satisfies Record<number, string>;

export const GOALS: Array<{ id: VisibleGoal; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: "improve_savings", label: "Build my savings", icon: "trending-up-outline" },
  { id: "emergency_fund", label: "Build an emergency fund", icon: "shield-checkmark-outline" },
  { id: "investments", label: "Grow my investments", icon: "pie-chart-outline" },
];

export const PAY_FREQUENCY_OPTIONS = [
  { id: "monthly", label: "Monthly" },
  { id: "every_2_weeks", label: "Every 2 weeks" },
  { id: "weekly", label: "Weekly" },
] as const;

export const BILL_FREQUENCY_OPTIONS = [
  { id: "monthly", label: "Monthly" },
  { id: "every_2_weeks", label: "Every 2 weeks" },
] as const;

export const PLANNING_YEARS_OPTIONS = [
  { id: "1", label: "1 year" },
  { id: "3", label: "3 years" },
  { id: "5", label: "5 years" },
  { id: "10", label: "10 years" },
] as const;

export function toVisibleGoal(value: OnboardingGoal | null | undefined): VisibleGoal | null {
  if (value === "improve_savings" || value === "build_budget") return "improve_savings";
  if (value === "emergency_fund" || value === "track_spending") return "emergency_fund";
  if (value === "investments" || value === "manage_debts") return "investments";
  return null;
}

export function normalizeVisibleGoals(values: Array<OnboardingGoal | null | undefined>): VisibleGoal[] {
  const filtered = values.map((value) => toVisibleGoal(value)).filter((value): value is VisibleGoal => value !== null);
  return filtered.length ? Array.from(new Set(filtered)) : DEFAULT_VISIBLE_GOALS;
}

export function buildInitialGoals(profile: OnboardingProfile | null | undefined): VisibleGoal[] {
  const fromProfile = profile?.mainGoals;
  const cleaned = Array.isArray(fromProfile) ? fromProfile.filter(Boolean) : [];
  if (cleaned.length) return normalizeVisibleGoals(cleaned);
  const single = profile?.mainGoal ?? null;
  return single ? normalizeVisibleGoals([single]) : DEFAULT_VISIBLE_GOALS;
}

export function isPositiveNumber(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}