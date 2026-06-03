import type { IncomeSacrificeData } from "@/lib/apiTypes";
import type { PayFrequency } from "@/lib/payPeriods";
import type { SavingsField, SavingsPot } from "@/types/settings";

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
  monthLabel: string;
  payDate: number;
  payFrequency: PayFrequency;
  sacrifice: IncomeSacrificeData | null;
  savingsPots: SavingsPot[];
  topInset?: number;
  onManageFlowActiveChange?: (active: boolean) => void;
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
    potId?: string;
    amount: number;
    startMonth: number;
    startYear: number;
    period: SacrificePeriod;
    skipSavingIndicator?: boolean;
  }) => Promise<void>;
  onEnsurePotAllocationRoute?: (args: {
    field: SavingsField;
    potId: string;
    potName: string;
  }) => Promise<string | null>;
  onDeleteCustom: (id: string) => Promise<void>;
  onCreateItem: (args: {
    type: IncomeSacrificeItemType;
    name: string;
    amount: number;
    broker?: string;
    goalTargetAmount?: number;
    goalTargetYear?: number;
  }) => Promise<void>;
  onUpdateInvestmentPotBroker?: (args: {
    potId: string;
    broker: string;
  }) => Promise<void>;
  onSaveGoalLink: (args: { targetKey: string; goalId: string | null }) => Promise<void>;
  onConfirmTransfer: (targetKey: string) => Promise<void>;
  goalLinkSaving: boolean;
  confirmingTargetKey: string | null;
  pendingNoticeText?: string;
  onDismissPendingNotice?: () => void;
  onGoHome?: () => void;
  onGoToCurrentPeriod?: () => void;
  onGoToNextPeriod?: () => void;
};