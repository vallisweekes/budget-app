import type { BillFrequency, PayFrequency } from "@/types/settings";

export const STRATEGY_OPTIONS = [
  { value: "payYourselfFirst", label: "Pay Yourself First", tip: "Prioritise savings and investment before discretionary spending." },
  { value: "zeroBased", label: "Zero-based", tip: "Assign every pound to a category so leftover becomes £0." },
  { value: "fiftyThirtyTwenty", label: "50/30/20", tip: "Split income into needs, wants, and savings/debt reduction." },
] as const;

export const PAY_FREQUENCY_OPTIONS: Array<{ value: PayFrequency; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "every_2_weeks", label: "Every 2 weeks" },
  { value: "weekly", label: "Weekly" },
];

export const BILL_FREQUENCY_OPTIONS: Array<{ value: BillFrequency; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "every_2_weeks", label: "Every 2 weeks" },
];

export const PLANNING_YEARS_OPTIONS = [
  { id: "1", label: "1 year" },
  { id: "3", label: "3 years" },
  { id: "5", label: "5 years" },
  { id: "10", label: "10 years" },
] as const;