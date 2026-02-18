import type { GoalsBudgetInsights, MonthKey } from "@/types";

import { getZeroBasedSummary } from "@/lib/budget/zero-based";
import { MONTHS } from "@/lib/constants/time";

export async function getGoalsBudgetInsights({
  budgetPlanId,
  monthsBack = 3,
  now = new Date(),
}: {
  budgetPlanId: string;
  monthsBack?: number;
  now?: Date;
}): Promise<GoalsBudgetInsights | null> {
  const recent = Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const month = MONTHS[d.getMonth()] as MonthKey;
    const year = d.getFullYear();
    return { month, year };
  });

  const recentSummaries = await Promise.all(
    recent.map(({ month, year }) => getZeroBasedSummary(budgetPlanId, month, { year }))
  );

  const activeSummaries = recentSummaries.filter((s) => {
    return (
      s.incomeTotal !== 0 ||
      s.expenseTotal !== 0 ||
      s.debtPaymentsTotal !== 0 ||
      s.spendingTotal !== 0 ||
      s.plannedAllowance !== 0 ||
      s.plannedSavings !== 0 ||
      s.plannedEmergency !== 0 ||
      s.plannedInvestments !== 0
    );
  });

  if (activeSummaries.length === 0) return null;

  const n = activeSummaries.length;
  const sum = activeSummaries.reduce(
    (acc, s) => {
      acc.income += s.incomeTotal;
      acc.expenses += s.expenseTotal;
      acc.debt += s.debtPaymentsTotal;
      acc.spending += s.spendingTotal;
      acc.allowance += s.plannedAllowance;
      acc.unallocated += s.unallocated;
      return acc;
    },
    { income: 0, expenses: 0, debt: 0, spending: 0, allowance: 0, unallocated: 0 }
  );

  return {
    basisLabel: n === 1 ? "the last month" : `the last ${n} months`,
    monthsUsed: n,
    avgIncomeTotal: sum.income / n,
    avgExpenseTotal: sum.expenses / n,
    avgDebtPaymentsTotal: sum.debt / n,
    avgSpendingTotal: sum.spending / n,
    avgPlannedAllowance: sum.allowance / n,
    avgUnallocated: sum.unallocated / n,
  };
}
