import type { DashboardData, DashboardGoal, Settings } from "@/lib/apiTypes";
import { resolveGoalCurrentAmount } from "@/lib/helpers/settings";

type GoalKind = "savings" | "emergency" | "investments" | "custom";

export type ProjectionLine = {
  id: string;
  title: string;
  label: string;
  color: string;
  areaTop: string;
  areaBottom: string;
  current: number;
  target: number;
  monthly: number;
  remaining: number;
  progressNow: number;
  progressProjected: number;
  points: number[];
  projectedEnd: number;
  monthsToTarget: number | null;
  etaLabel: string | null;
  statusLabel: string;
};

export type GoalsProjectionModel = {
  months: number;
  maxY: number;
  endYear: number;
  lines: ProjectionLine[];
  totalCurrent: number;
  totalProjected: number;
  monthlyTotal: number;
  onTrackCount: number;
};

function resolveProjectionMonths(goals: DashboardGoal[], fallbackMonths: number) {
  const nowYear = new Date().getFullYear();
  const targetYears = goals
    .map((goal) => Number(goal.targetYear))
    .filter((year) => Number.isFinite(year) && year >= nowYear)
    .map((year) => Math.floor(year));

  if (targetYears.length === 0) {
    return {
      months: fallbackMonths,
      endYear: nowYear + Math.max(1, Math.ceil(fallbackMonths / 12)) - 1,
    };
  }

  const furthestTargetYear = Math.max(...targetYears);
  return {
    months: Math.max(12, (furthestTargetYear - nowYear + 1) * 12),
    endYear: furthestTargetYear,
  };
}

const SERIES_COLORS = [
  { line: "#7c5cff", areaTop: "rgba(124,92,255,0.28)", areaBottom: "rgba(124,92,255,0.02)" },
  { line: "#2ee58f", areaTop: "rgba(46,229,143,0.24)", areaBottom: "rgba(46,229,143,0.02)" },
  { line: "#ffb020", areaTop: "rgba(255,176,32,0.24)", areaBottom: "rgba(255,176,32,0.02)" },
  { line: "#53c7ff", areaTop: "rgba(83,199,255,0.24)", areaBottom: "rgba(83,199,255,0.02)" },
];

function classifyGoal(goal: DashboardGoal): GoalKind {
  const haystack = `${String(goal.category ?? "")} ${String(goal.type ?? "")} ${String(goal.title ?? "")}`.toLowerCase();
  if (haystack.includes("emergency")) return "emergency";
  if (haystack.includes("invest")) return "investments";
  if (haystack.includes("saving")) return "savings";
  return "custom";
}

function getMonthlyContribution(goal: DashboardGoal, dashboard: DashboardData): number {
  const kind = classifyGoal(goal);
  if (kind === "emergency") return Math.max(0, dashboard.plannedEmergencyContribution ?? 0);
  if (kind === "investments") return Math.max(0, dashboard.plannedInvestments ?? 0);
  if (kind === "savings") return Math.max(0, dashboard.plannedSavingsContribution ?? 0);
  return 0;
}

function addMonthsLabel(monthsAhead: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsAhead);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function buildStatusLabel(current: number, target: number, projectedEnd: number, monthly: number): string {
  if (target > 0 && current >= target) return "Reached";
  if (target > 0 && projectedEnd >= target && monthly > 0) return "On track";
  if (monthly <= 0) return "No monthly pace";
  if (target > 0) return "Needs boost";
  return "Growing";
}

function buildScenarioMonthlyByGoal(goals: Array<{ id: string; current: number; target: number; monthly: number }>, scenarioMonthlyTotal: number): Map<string, number> {
  const next = new Map<string, number>();
  const allocatableGoals = goals.filter((goal) => goal.target <= 0 || goal.current < goal.target);

  if (allocatableGoals.length === 0 || scenarioMonthlyTotal <= 0) {
    goals.forEach((goal) => next.set(goal.id, 0));
    return next;
  }

  const baseWeightSource = allocatableGoals.some((goal) => goal.monthly > 0)
    ? allocatableGoals.map((goal) => Math.max(0, goal.monthly))
    : allocatableGoals.some((goal) => goal.target > 0)
      ? allocatableGoals.map((goal) => Math.max(1, goal.target - goal.current))
      : allocatableGoals.map(() => 1);

  const weightTotal = baseWeightSource.reduce((sum, weight) => sum + weight, 0);

  allocatableGoals.forEach((goal, index) => {
    const weight = baseWeightSource[index] ?? 0;
    const allocated = weightTotal > 0 ? (scenarioMonthlyTotal * weight) / weightTotal : scenarioMonthlyTotal / allocatableGoals.length;
    next.set(goal.id, Math.round(allocated * 100) / 100);
  });

  goals.forEach((goal) => {
    if (!next.has(goal.id)) next.set(goal.id, 0);
  });

  return next;
}

export function buildGoalsProjection(
  dashboard: DashboardData | null,
  settings: Pick<Settings, "savingsBalance" | "emergencyBalance" | "investmentBalance"> | null | undefined,
  options?: {
    months?: number;
    scenarioMonthlyTotal?: number | null;
  },
): GoalsProjectionModel | null {
  const fallbackMonths = options?.months ?? 12;
  const goals = dashboard?.goals ?? [];
  if (!dashboard || goals.length === 0) return null;

  const { months, endYear } = resolveProjectionMonths(goals, fallbackMonths);

  const baseGoalInputs = goals.map((goal) => {
    const current = Math.max(0, resolveGoalCurrentAmount(goal.category, goal.currentAmount, settings));
    const target = Math.max(0, Number(goal.targetAmount ?? 0));
    const monthly = getMonthlyContribution(goal, dashboard);
    return {
      goal,
      current,
      target,
      monthly,
    };
  });

  const scenarioMonthlyByGoal = typeof options?.scenarioMonthlyTotal === "number"
    ? buildScenarioMonthlyByGoal(
      baseGoalInputs.map(({ goal, current, target, monthly }) => ({ id: goal.id, current, target, monthly })),
      Math.max(0, options.scenarioMonthlyTotal),
    )
    : null;

  const lines = baseGoalInputs
    .map(({ goal, current, target, monthly: baseMonthly }, index) => {
      const palette = SERIES_COLORS[index % SERIES_COLORS.length]!;
      const monthly = scenarioMonthlyByGoal?.get(goal.id) ?? baseMonthly;
      const points = Array.from({ length: months + 1 }, (_, i) => {
        return current + monthly * i;
      });

      const projectedEnd = points[points.length - 1] ?? current;
      if (current <= 0 && target <= 0 && monthly <= 0 && projectedEnd <= 0) {
        return null;
      }

      const remaining = Math.max(0, target - current);
      const progressNow = target > 0 ? Math.max(0, Math.min(1, current / target)) : 0;
      const progressProjected = target > 0 ? Math.max(0, Math.min(1, projectedEnd / target)) : 0;
      const monthsToTarget = target > 0 && current < target
        ? (monthly > 0 ? Math.ceil((target - current) / monthly) : null)
        : 0;
      const etaLabel = monthsToTarget == null
        ? null
        : monthsToTarget === 0
          ? "Already funded"
          : addMonthsLabel(monthsToTarget);

      return {
        id: goal.id,
        title: goal.title,
        label: goal.targetYear ? `Target ${goal.targetYear}` : String(goal.type ?? "Goal"),
        color: palette.line,
        areaTop: palette.areaTop,
        areaBottom: palette.areaBottom,
        current,
        target,
        monthly,
        remaining,
        progressNow,
        progressProjected,
        points,
        projectedEnd,
        monthsToTarget,
        etaLabel,
        statusLabel: buildStatusLabel(current, target, projectedEnd, monthly),
      } satisfies ProjectionLine;
    })
    .filter((line): line is ProjectionLine => Boolean(line))
    .sort((left, right) => right.projectedEnd - left.projectedEnd);

  if (lines.length === 0) return null;

  const maxY = Math.max(
    1,
    ...lines.flatMap((line) => [
      ...line.points,
      line.target,
    ]),
  );

  return {
    months,
    maxY,
    endYear,
    lines,
    totalCurrent: lines.reduce((sum, line) => sum + line.current, 0),
    totalProjected: lines.reduce((sum, line) => sum + line.projectedEnd, 0),
    monthlyTotal: lines.reduce((sum, line) => sum + line.monthly, 0),
    onTrackCount: lines.filter((line) => line.statusLabel === "Reached" || line.statusLabel === "On track").length,
  } satisfies GoalsProjectionModel;
}