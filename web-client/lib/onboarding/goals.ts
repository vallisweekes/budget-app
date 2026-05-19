import { prisma } from "@/lib/prisma";

import type { OnboardingGoalInput, VisibleOnboardingGoal } from "./types";

type GoalConfig = {
  title: string;
  type: "short_term" | "long_term";
  category: "savings" | "emergency" | "investment";
  legacyTitles: string[];
};

const ONBOARDING_GOAL_CONFIG: Record<VisibleOnboardingGoal, GoalConfig> = {
  improve_savings: {
    title: "Savings",
    type: "short_term",
    category: "savings",
    legacyTitles: ["Improve savings", "Set up my monthly budget"],
  },
  emergency_fund: {
    title: "Emergency fund",
    type: "short_term",
    category: "emergency",
    legacyTitles: ["Keep track of spending"],
  },
  investments: {
    title: "Investments",
    type: "long_term",
    category: "investment",
    legacyTitles: ["Manage debts better"],
  },
};

function isOnboardingGoal(value: unknown): value is OnboardingGoalInput {
  return value === "improve_savings"
    || value === "emergency_fund"
    || value === "investments"
    || value === "manage_debts"
    || value === "track_spending"
    || value === "build_budget";
}

export function cleanGoals(input: unknown): OnboardingGoalInput[] | null {
  if (!Array.isArray(input)) return null;
  const cleaned = input.filter(isOnboardingGoal);
  return cleaned.length ? Array.from(new Set(cleaned)) : [];
}

function toVisibleOnboardingGoal(goal: OnboardingGoalInput | null | undefined): VisibleOnboardingGoal | null {
  if (goal === "improve_savings" || goal === "build_budget") return "improve_savings";
  if (goal === "emergency_fund" || goal === "track_spending") return "emergency_fund";
  if (goal === "investments" || goal === "manage_debts") return "investments";
  return null;
}

export function normalizeSelectedGoals(goals: OnboardingGoalInput[]): VisibleOnboardingGoal[] {
  const normalized = goals
    .map((goal) => toVisibleOnboardingGoal(goal))
    .filter((goal): goal is VisibleOnboardingGoal => goal !== null);
  return Array.from(new Set(normalized));
}

export async function syncGeneratedGoals(options: {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  budgetPlanId: string;
  selectedGoals: OnboardingGoalInput[];
  savingsGoalAmount: number;
  targetYear: number;
}) {
  const { tx, budgetPlanId, selectedGoals, savingsGoalAmount, targetYear } = options;
  const desiredConfigs = normalizeSelectedGoals(selectedGoals).map((goal) => ONBOARDING_GOAL_CONFIG[goal]);
  const relevantTitles = Array.from(new Set(
    Object.values(ONBOARDING_GOAL_CONFIG).flatMap((config) => [config.title, ...config.legacyTitles]),
  ));
  const existingGoals = await tx.goal.findMany({
    where: { budgetPlanId, title: { in: relevantTitles } },
    select: { id: true, title: true },
  });

  const takenGoalIds = new Set<string>();
  for (const config of desiredConfigs) {
    const match = existingGoals.find((goal) => !takenGoalIds.has(goal.id)
      && (goal.title === config.title || config.legacyTitles.includes(goal.title)));
    if (match) {
      takenGoalIds.add(match.id);
      await tx.goal.update({
        where: { id: match.id },
        data: {
          title: config.title,
          type: config.type,
          category: config.category,
          targetAmount: savingsGoalAmount > 0 ? savingsGoalAmount : 1000,
          targetYear,
        },
      });
      continue;
    }

    const created = await tx.goal.create({
      data: {
        budgetPlanId,
        title: config.title,
        type: config.type,
        category: config.category,
        targetAmount: savingsGoalAmount > 0 ? savingsGoalAmount : 1000,
        currentAmount: 0,
        targetYear,
      },
      select: { id: true },
    });
    takenGoalIds.add(created.id);
  }

  const obsoleteGoals = existingGoals.filter((goal) => !takenGoalIds.has(goal.id));
  if (obsoleteGoals.length > 0) {
    await tx.goal.deleteMany({ where: { id: { in: obsoleteGoals.map((goal) => goal.id) } } });
  }
}