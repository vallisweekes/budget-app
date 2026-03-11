import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { CreditCard, DebtPayment } from "@/lib/apiTypes";
import type { DebtStackParamList } from "@/navigation/types";

export type DebtDetailRoute = RouteProp<DebtStackParamList, "DebtDetail">;
export type DebtDetailNav = NativeStackNavigationProp<DebtStackParamList, "DebtDetail">;

export type DebtHeroProps = {
  debtName: string;
  logoUrl?: string | null;
  currentBalanceLabel: string;
  currentBalanceValue: string;
  isPaid: boolean;
  progressPct: number;
  isVerySmallScreen: boolean;
  topInset?: number;
  onRecordPayment: () => void;
};

export type PaymentHistorySectionProps = {
  payments: DebtPayment[];
  currency: string;
  open: boolean;
  onToggle: () => void;
};

export type PaymentSheetProps = {
  visible: boolean;
  currency: string;
  payAmount: string;
  paying: boolean;
  onChangeAmount: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onMarkPaid?: () => void;
  showMarkPaid?: boolean;
  markPaidLabel?: string;
};

export type DebtDetailHeaderProps = {
  title: string;
  editing: boolean;
  onBack: () => void;
  onToggleEdit: () => void;
  onDelete: () => void;
  hideActions?: boolean;
};

export type EditDebtSheetProps = {
  visible: boolean;
  saving: boolean;
  currency?: string | null;
  name: string;
  currentBalance: string;
  interestRate: string;
  monthlyPayment: string;
  monthlyMinimum: string;
  dueDate: string;
  installment: string;
  paymentSource: "income" | "extra_funds" | "credit_card";
  paymentCardDebtId: string;
  paymentCards: CreditCard[];
  showDatePicker: boolean;
  onClose: () => void;
  onSave: () => void;
  onChangeName: (v: string) => void;
  onChangeCurrentBalance: (v: string) => void;
  onChangeRate: (v: string) => void;
  onChangeMonthlyPayment: (v: string) => void;
  onChangeMin: (v: string) => void;
  onPickDate: () => void;
  onDateChange: (value: string) => void;
  onChangePaymentSource: (v: "income" | "extra_funds" | "credit_card") => void;
  onChangePaymentCardDebtId: (v: string) => void;
  onChangeInstallment: (v: string) => void;
  onSetShowDatePicker: (v: boolean) => void;
};

export type DebtStatsGridProps = {
  isCardDebt: boolean;
  creditLimit: string;
  original: string;
  paidSoFar: string;
  dueCoveredThisCycle: boolean;
  dueDateLabel: string;
  dueStatusSub?: string;
  dueTone: "normal" | "green" | "orange" | "red";
  monthlyOrInterestLabel: string;
  monthlyOrInterestValue: string;
  monthlyOrInterestSub?: string;
};

export type PayoffChartProps = {
  balance: number;
  monthlyPayment: number;
  interestRate: number | null;
  currency: string;
  monthsLeftOverride?: number | null;
  paidOffByOverride?: string | null;
  cannotPayoffOverride?: boolean;
  payoffLabelOverride?: string | null;
  horizonLabelOverride?: string;
};