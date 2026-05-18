import { Ionicons } from "@expo/vector-icons";

import { BRAND_BLUE } from "@/lib/constants/theme";
import { T } from "@/lib/theme";

import type { VisibleGoal } from "@/types/OnboardingScreen.types";

export const DEFAULT_VISIBLE_GOALS: VisibleGoal[] = ["improve_savings"];
export const EXPENSES_TOTAL_BLUE = BRAND_BLUE;

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

export const COMMON_OCCUPATIONS = [
  "Accountant",
  "Admin assistant",
  "Architect",
  "Business owner",
  "Chef",
  "Construction worker",
  "Consultant",
  "Customer service",
  "Data analyst",
  "Designer",
  "Driver",
  "Electrician",
  "Engineer",
  "Finance professional",
  "Freelancer",
  "Healthcare assistant",
  "Hospitality",
  "HR professional",
  "IT support",
  "Lawyer",
  "Manager",
  "Marketing",
  "Mechanic",
  "Nurse",
  "Teacher",
  "Office worker",
  "Operations",
  "Pharmacist",
  "Product manager",
  "Project manager",
  "Retail",
  "Sales",
  "Self-employed",
  "Skilled trades",
  "Social worker",
  "Student",
  "Unemployed",
  "Retired",
  "Other",
] as const;

export const OCCUPATIONS_REQUIRING_INCOME_SOURCE = ["student", "unemployed", "retired"] as const;

export const OCCUPATION_INCOME_SOURCE_OPTIONS = {
  student: ["Student Grant", "Family fund", "Part time job", "Other"],
  retired: ["Pension", "Self funding", "Family fund", "Other"],
  unemployed: ["Benefits", "Family fund", "Other"],
} as const;