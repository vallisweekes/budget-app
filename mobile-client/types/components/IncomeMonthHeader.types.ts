export type IncomeMonthViewMode = "income" | "sacrifice";

export type IncomeMonthHeaderProps = {
  monthLabel: string;
  isLocked: boolean;
  viewMode: IncomeMonthViewMode;
  showAddForm: boolean;
  hideNavTitleRow?: boolean;
  onBack: () => void;
  onToggleAdd: () => void;
  onSetMode: (mode: IncomeMonthViewMode) => void;
};