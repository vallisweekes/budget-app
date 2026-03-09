import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";

import type { VisibleGoal } from "@/types/OnboardingScreen.types";

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