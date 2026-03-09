import { Ionicons } from "@expo/vector-icons";

import type { OnboardingGoal, OnboardingProfile } from "@/lib/apiTypes";
import { DEFAULT_VISIBLE_GOALS } from "@/lib/constants";

import type { VisibleGoal } from "@/types/OnboardingScreen.types";

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