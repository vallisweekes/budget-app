export type IncomeEditSheetProps = {
  visible: boolean;
  name: string;
  amount: string;
  currency: string;
  totalIncome: number;
  setName: (value: string) => void;
  setAmount: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  isLocked: boolean;
};

export type IncomeEditSheetPctChartProps = {
  pct: number | null;
};