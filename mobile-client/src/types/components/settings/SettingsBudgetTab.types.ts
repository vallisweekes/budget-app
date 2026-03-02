import type { BudgetField } from "@/types/settings";

export type SettingsBudgetTabProps = {
  payDate: number | null | undefined;
  horizonYears: number;
  payFrequencyLabel: string;
  billFrequencyLabel: string;
  strategyDraft: string;
  onOpenField: (field: BudgetField) => void;
  onOpenStrategy: () => void;
};
