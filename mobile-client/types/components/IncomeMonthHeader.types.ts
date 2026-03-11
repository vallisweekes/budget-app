export type IncomeMonthViewMode = "income" | "sacrifice";

export type IncomeMonthHeaderProps = {
  monthLabel: string;
  isLocked: boolean;
  viewMode: IncomeMonthViewMode;
  showAddForm: boolean;
  hideNavTitleRow?: boolean;
  onHeightChange?: (height: number) => void;
  onBack: () => void;
  onToggleAdd: () => void;
  onSetMode: (mode: IncomeMonthViewMode) => void;
};