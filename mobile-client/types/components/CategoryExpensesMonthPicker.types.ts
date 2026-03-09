import type React from "react";

export type CategoryExpensesMonthPickerProps = {
  month: number;
  onClose: () => void;
  onSelectMonth: (month: number) => void;
  pickerYear: number;
  setPickerYear: React.Dispatch<React.SetStateAction<number>>;
  shortMonths: string[];
  visible: boolean;
  year: number;
};