import type { Animated } from "react-native";

import type { BillFrequency, BudgetField, PayFrequency } from "@/types/settings";

export type SettingsBudgetFieldSheetProps = {
  field: BudgetField | null;
  keyboardOffset: number;
  translateY: Animated.Value;
  panHandlers: Record<string, unknown>;
  payDateDraft: string;
  horizonDraft: string;
  payFrequencyDraft: PayFrequency;
  billFrequencyDraft: BillFrequency;
  payFrequencyOptions: Array<{ value: PayFrequency; label: string }>;
  billFrequencyOptions: Array<{ value: BillFrequency; label: string }>;
  saveBusy: boolean;
  onClose: () => void;
  onChangePayDate: (value: string) => void;
  onChangeHorizon: (value: string) => void;
  onChangePayFrequency: (value: PayFrequency) => void;
  onChangeBillFrequency: (value: BillFrequency) => void;
  onSave: () => void;
};
