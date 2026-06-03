type BudgetDonutMetrics = {
  remaining: number;
  isOverBudget: boolean;
  usedWithinBudget: number;
  remainingBudget: number;
  overspend: number;
  usedFrac: number;
  remainingFrac: number;
  overspendFrac: number;
  hasData: boolean;
};

export function computeBudgetDonutMetrics(
  totalBudget: number | null | undefined,
  totalExpenses: number | null | undefined,
  paidTotal: number | null | undefined,
): BudgetDonutMetrics {
  const safeBudget = Math.max(0, totalBudget ?? 0);
  const safeExpenses = Math.max(0, totalExpenses ?? 0);
  const safeSpent = typeof paidTotal === "number" && Number.isFinite(paidTotal)
    ? Math.max(0, paidTotal)
    : safeExpenses;
  const left = safeBudget - safeSpent;
  const spentWithinBudget = Math.min(safeBudget, safeSpent);
  const remainingBudget = Math.max(0, safeBudget - spentWithinBudget);
  const overspend = Math.max(0, safeSpent - safeBudget);

  const usedFrac = safeBudget > 0 ? Math.min(1, spentWithinBudget / safeBudget) : 0;
  const remainingFrac = safeBudget > 0 ? Math.min(1, remainingBudget / safeBudget) : 0;
  const overspendFrac = safeBudget > 0 ? Math.min(1, overspend / safeBudget) : 0;

  return {
    remaining: left,
    isOverBudget: left < 0,
    usedWithinBudget: spentWithinBudget,
    remainingBudget,
    overspend,
    usedFrac,
    remainingFrac,
    overspendFrac,
    hasData: safeBudget > 0 || safeSpent > 0,
  };
}

export function getBudgetDonutSize(viewportWidth: number): number {
  return Math.min(250, Math.floor((viewportWidth - 64) * 0.8));
}
