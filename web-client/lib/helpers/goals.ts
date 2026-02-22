import type { Goal } from "@/lib/goals/store";
import type { GoalsBudgetInsights } from "@/types";

import { formatCurrency } from "@/lib/helpers/money";

function getMonthsRemaining(endYear: number, now: Date): number {
  const nowMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const end = new Date(endYear, 11, 31);
  const endMonthIndex = end.getFullYear() * 12 + end.getMonth();
  const diff = endMonthIndex - nowMonthIndex;
  if (diff < 0) return 0;
  return diff + 1;
}

export function getGoalMonthlyTip({
  goal,
  budgetInsights,
  now = new Date(),
}: {
  goal: Goal;
  budgetInsights?: GoalsBudgetInsights | null;
  now?: Date;
}): string | null {
  if (goal.targetAmount == null) return null;

  const remainingAmount = Math.max(0, goal.targetAmount - (goal.currentAmount ?? 0));
  if (remainingAmount <= 0) return null;

  const effectiveTargetYear =
    goal.targetYear ?? (goal.type === "yearly" ? now.getFullYear() : undefined);

  if (effectiveTargetYear == null) {
    return "Set a target year to get a personalized monthly plan.";
  }

  const monthsRemaining = getMonthsRemaining(effectiveTargetYear, now);
  if (monthsRemaining <= 0) {
    return "Your target year has passed — update it to get a monthly plan.";
  }

  const requiredPerMonth = remainingAmount / monthsRemaining;
  const deadlineLabel = goal.targetYear ? String(goal.targetYear) : "the end of this year";

  if (!budgetInsights) {
    return `To reach this goal by ${deadlineLabel}, save about ${formatCurrency(requiredPerMonth)} per month.`;
  }

  const avgUnallocated = budgetInsights.avgUnallocated;
  const avgSpending = budgetInsights.avgSpendingTotal;
  const avgAllowance = budgetInsights.avgPlannedAllowance;

  const basis = budgetInsights.basisLabel;
  const requiredLabel = formatCurrency(requiredPerMonth);
  const unallocatedLabel = formatCurrency(avgUnallocated);
  const unallocatedAbsLabel = formatCurrency(Math.abs(avgUnallocated));

  const shortBy = requiredPerMonth - avgUnallocated;
  const overspend = avgSpending - avgAllowance;
  const allowanceHeadroom = avgAllowance - avgSpending;

  if (avgUnallocated >= requiredPerMonth) {
    const remainingAfter = avgUnallocated - requiredPerMonth;
    let tip =
      `Based on ${basis}, you typically have about ${unallocatedLabel}/mo unallocated. ` +
      `Setting aside ${requiredLabel}/mo gets you there by ${deadlineLabel} and leaves ~${formatCurrency(remainingAfter)}/mo spare.`;
    if (allowanceHeadroom < 0) {
      tip += ` You’re also overspending your allowance by ~${formatCurrency(Math.abs(allowanceHeadroom))}/mo.`;
    }
    return tip;
  }

  if (avgUnallocated > 0) {
    let tip =
      `Based on ${basis}, you usually have ~${unallocatedLabel}/mo unallocated. ` +
      `To hit ${deadlineLabel}, aim for ${requiredLabel}/mo (short by ~${formatCurrency(shortBy)}/mo).`;

    if (overspend > 0) {
      tip += ` Your spending is ~${formatCurrency(avgSpending)}/mo vs a ${formatCurrency(avgAllowance)}/mo allowance (over by ~${formatCurrency(overspend)}/mo).`;
      tip += ` Tightening spending by ~${formatCurrency(Math.min(shortBy, overspend))}/mo would make this achievable.`;
    } else {
      tip += ` Cutting discretionary spending by ~${formatCurrency(shortBy)}/mo or extending the target year would close the gap.`;
    }
    return tip;
  }

  const totalToFree = Math.abs(avgUnallocated) + requiredPerMonth;
  return (
    `Based on ${basis}, you’re over-allocated by ~${unallocatedAbsLabel}/mo. ` +
    `To reach this by ${deadlineLabel}, you’d need to free up about ${formatCurrency(totalToFree)}/mo (reduce spending or increase income), then set aside ${requiredLabel}/mo.`
  );
}
