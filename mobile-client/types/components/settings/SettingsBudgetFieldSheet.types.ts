import type { Animated } from "react-native";

import type { BudgetField, PayFrequency } from "@/types/settings";

export type SettingsBudgetFieldSheetProps = {
  field: BudgetField | null;
  keyboardOffset: number;
  translateY: Animated.Value;
  panHandlers: Record<string, unknown>;
  payDateDraft: string;
  horizonDraft: string;
  payFrequencyDraft: PayFrequency;
  payFrequencyOptions: Array<{ value: PayFrequency; label: string }>;
  saveBusy: boolean;
  onClose: () => void;
  onChangePayDate: (value: string) => void;
  onChangeHorizon: (value: string) => void;
  onChangePayFrequency: (value: PayFrequency) => void;
  onSave: () => void;
};
