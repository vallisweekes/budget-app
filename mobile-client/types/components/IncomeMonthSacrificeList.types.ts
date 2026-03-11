import type { IncomeSacrificeData } from "@/lib/apiTypes";

export type SacrificePeriod =
  | "this_month"
  | "next_six_months"
  | "remaining_months"
  | "two_years"
  | "five_years"
  | "ten_years";

export type AmountEntryMode = "set" | "adjust";

export type IncomeSacrificeItemType = "allowance" | "savings" | "emergency" | "investment" | "custom";

export type TargetOption = {
  key: string;
  label: string;
  kind: "fixed" | "custom";
  fixedField?: "monthlyAllowance" | "monthlySavingsContribution" | "monthlyEmergencyContribution" | "monthlyInvestmentContribution";
  customAllocationId?: string;
};

export type IncomeMonthSacrificeListProps = {
  currency: string;
  month: number;
  year: number;
  sacrifice: IncomeSacrificeData | null;
  topInset?: number;
  canManage?: boolean;
  manageUnavailableReason?: string;
  sacrificeSaving: boolean;
  sacrificeCreating: boolean;
  sacrificeDeletingId: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onApplySacrificeAmount: (args: {
    targetType: "fixed" | "custom";
    fixedField?: "monthlyAllowance" | "monthlySavingsContribution" | "monthlyEmergencyContribution" | "monthlyInvestmentContribution";
    customAllocationId?: string;
    amount: number;
    startMonth: number;
    startYear: number;
    period: SacrificePeriod;
  }) => Promise<void>;
  onDeleteCustom: (id: string) => Promise<void>;
  onCreateItem: (args: { type: IncomeSacrificeItemType; name: string }) => Promise<void>;
  onSaveGoalLink: (args: { targetKey: string; goalId: string | null }) => Promise<void>;
  onConfirmTransfer: (targetKey: string) => Promise<void>;
  goalLinkSaving: boolean;
  confirmingTargetKey: string | null;
  pendingNoticeText?: string;
  onDismissPendingNotice?: () => void;
};