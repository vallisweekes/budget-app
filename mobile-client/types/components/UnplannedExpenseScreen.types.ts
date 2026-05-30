import type { Animated, PanResponderInstance } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { ExpensesStackParamList } from "@/navigation/types";

export type UnplannedExpenseScreenProps = NativeStackScreenProps<ExpensesStackParamList, "UnplannedExpense">;

export type CategoryOption = {
  id: string;
  name: string;
  color?: string | null;
};

export type DebtOption = {
  id: string;
  name: string;
};

export type SelectionItem = {
  id: string;
  label: string;
  color?: string | null;
};

export type UnplannedExpenseFormProps = {
  amount: string;
  canSubmit: boolean;
  categoryId: string;
  currency: string;
  fundingLabel: string;
  fundingSource: string;
  loadingData: boolean;
  name: string;
  needsDebtChoice: boolean;
  newLoanName: string;
  parsedAmount: number;
  periodLabel: string;
  selectedCategory?: CategoryOption;
  selectedDebt?: DebtOption;
  submitError: string | null;
  submitting: boolean;
  topContentInset: number;
  usingNewLoan: boolean;
  onAmountChange: (value: string) => void;
  onCategoryPress: () => void;
  onDebtPress: () => void;
  onDescriptionChange: (value: string) => void;
  onFundingPress: () => void;
  onPeriodPress: () => void;
  onNewLoanNameChange: (value: string) => void;
  onScanReceiptPress: () => void;
  onSubmit: () => void;
};

export type SelectionSheetProps = {
  dragY: Animated.Value;
  emptyText?: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  panHandlers: PanResponderInstance["panHandlers"];
  selectedId: string;
  title: string;
  visible: boolean;
  items: SelectionItem[];
};

export type MonthPickerSheetProps = {
  dragY: Animated.Value;
  month: number;
  onClose: () => void;
  onMonthSelect: (month: number) => void;
  onNextYear: () => void;
  onPrevYear: () => void;
  panHandlers: PanResponderInstance["panHandlers"];
  pickerYear: number;
  visible: boolean;
  year: number;
};

export type ScanReceiptShortcutProps = {
  onPress: () => void;
};