import type { CurrencyFormatter } from "./BudgetDonutCard.types";

export interface BudgetProgressProps {
  progressPct: number;
  isOverBudget: boolean;
  amountAfterExpenses: number;
  currency: string;
  fmt: CurrencyFormatter;
}
