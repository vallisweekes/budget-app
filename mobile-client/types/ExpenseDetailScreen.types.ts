
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { Expense, ExpenseFrequencyPointStatus } from "@/lib/apiTypes";
import type { ExpensesStackParamList } from "@/navigation/types";

export type ExpenseDetailScreenProps = NativeStackScreenProps<ExpensesStackParamList, "ExpenseDetail">;

export type MonthPoint = {
  key: string;
  month: number;
  year: number;
  label: string;
  ratio: number;
  present: boolean;
  status: ExpenseFrequencyPointStatus;
};

export type LoadState = {
  expense: Expense | null;
  categoryExpenses: Expense[];
};

export type FrequencyIndicator = {
  kind: "good" | "moderate" | "bad";
  label: string;
  color: string;
};

export type FrequencyDisplay = {
  subtitle: string;
  points: MonthPoint[];
};

export type SparkState = {
  w: number;
  h: number;
  pad: number;
  lastKnownIndex: number;
  polylinePoints: string;
  toXY: (index: number) => { x: number; y: number };
};

export type EditPeriodContext = {
  span: string;
  range: string;
};

export type ExpenseDetailScreenControllerState = {
  amountNum: number;
  canEditPaidPayment: boolean;
  compactQuickRow: boolean;
  currency: string;
  deleteConfirmOpen: boolean;
  deleting: boolean;
  displayName: string;
  dueDateBadgeColor: string;
  dueDateLabel: string;
  editPeriodContext: EditPeriodContext;
  editSheetOpen: boolean;
  error: string | null;
  expense: Expense | null;
  expenseName: string;
  freqDisplay: FrequencyDisplay;
  freqIndicator: FrequencyIndicator | null;
  frequencyLoading: boolean;
  hasFrequencyHistory: boolean;
  height: number;
  insetsTop: number;
  isLoggedNonIncomeExpense: boolean;
  isPaid: boolean;
  loading: boolean;
  lockedHintVisible: boolean;
  logoFailed: boolean;
  logoUri: string | null;
  paidNum: number;
  payAmount: string;
  paySheetOpen: boolean;
  paying: boolean;
  paymentEditGraceDays: number;
  refreshing: boolean;
  remainingNum: number;
  shouldShowFrequencyCard: boolean;
  shouldShowStatusGraceNote: boolean;
  showBottomActions: boolean;
  showDeleteScopeChoices: boolean;
  showLogo: boolean;
  showQuickActions: boolean;
  showRetryState: boolean;
  showSkeleton: boolean;
  spark: SparkState;
  statusGraceNote: string;
  tabBarHeight: number;
  tipIndex: number;
  tips: string[];
  unpaidConfirmOpen: boolean;
  unpaidWarningText: string;
  updatedLabel: string;
  deleteConfirmDescription: string;
  onChangePayAmount: (value: string) => void;
  onCloseDeleteConfirm: () => void;
  onCloseEditSheet: () => void;
  onClosePaymentSheet: () => void;
  onCloseUnpaidConfirm: () => void;
  onConfirmDelete: () => Promise<void>;
  onConfirmDeleteFuture: () => Promise<void>;
  onConfirmUnpaid: () => Promise<void>;
  onGoBack: () => void;
  onLogoError: () => void;
  onMarkPaid: () => Promise<void>;
  onOpenDeleteConfirm: () => void;
  onOpenEditSheet: () => void;
  onOpenRecordPayment: () => void;
  onOpenUnpaidConfirm: () => void;
  onRefresh: () => void;
  onRetry: () => void;
  onSaveEdit: () => void;
  onSavePayment: () => Promise<void>;
};