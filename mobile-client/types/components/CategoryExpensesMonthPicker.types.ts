import type React from "react";

export type CategoryExpensesMonthPickerProps = {
  month: number;
  onClose: () => void;
  onSelectMonth: (month: number) => void;
  pickerYear: number;
  setPickerYear: React.Dispatch<React.SetStateAction<number>>;
  getPeriodOptionLabel: (targetMonth: number, targetYear: number) => string;
  visible: boolean;
  year: number;
};