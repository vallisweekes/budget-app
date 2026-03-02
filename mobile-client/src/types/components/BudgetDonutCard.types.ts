export type CurrencyFormatter = (v: number | string | null | undefined, c: string) => string;

export interface BudgetDonutCardProps {
  totalBudget: number;
  totalExpenses: number;
  paidTotal: number;
  currency: string;
  fmt: CurrencyFormatter;
}
