type BudgetDonutMetrics = {
  remaining: number;
  isOverBudget: boolean;
  paidFrac: number;
  committedFrac: number;
  hasData: boolean;
};

export function computeBudgetDonutMetrics(
  totalBudget: number | null | undefined,
  totalExpenses: number | null | undefined,
  paidTotal: number | null | undefined,
): BudgetDonutMetrics {
  const safeBudget = Math.max(0, totalBudget ?? 0);
  const safeExpenses = Math.max(0, totalExpenses ?? 0);
  const safePaid = Math.max(0, paidTotal ?? 0);

  const paid = Math.min(safeExpenses, safePaid);
  const committed = Math.max(0, safeExpenses - paid);
  const left = safeBudget - safeExpenses;

  const paidFrac = safeBudget > 0 ? Math.min(1, paid / safeBudget) : 0;
  const committedFrac = safeBudget > 0 ? Math.min(1 - paidFrac, committed / safeBudget) : 0;

  return {
    remaining: left,
    isOverBudget: left < 0,
    paidFrac,
    committedFrac,
    hasData: safeBudget > 0 || safeExpenses > 0,
  };
}

export function getBudgetDonutSize(viewportWidth: number): number {
  return Math.min(250, Math.floor((viewportWidth - 64) * 0.8));
}
