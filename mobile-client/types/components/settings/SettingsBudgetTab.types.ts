import type { BudgetField } from "@/types/settings";

export type SettingsBudgetTabProps = {
  payDate: number | null | undefined;
  horizonYears: number;
  payFrequencyLabel: string;
  strategyDraft: string;
  onOpenField: (field: BudgetField) => void;
  onOpenStrategy: () => void;
  onOpenIncomeSettings: () => void;
};
