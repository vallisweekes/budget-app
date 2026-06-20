export type CategoryExpensesHeroProps = {
  canAddExpenseInSelectedPeriod: boolean;
  currency: string;
  flat?: boolean;
  heroPeriodLabel: string;
  onPressAdd: () => void;
  onPressMonth: () => void;
  paidPct: number;
  paidTotal: number;
  plannedTotal: number;
  remainingPct: number;
  remainingTotal: number;
  topHeaderOffset: number;
  updatedLabel: string;
};