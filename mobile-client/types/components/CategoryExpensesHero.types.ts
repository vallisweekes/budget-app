export type CategoryExpensesHeroProps = {
  currency: string;
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