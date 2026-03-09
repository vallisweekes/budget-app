export type PaymentDetailPayment = {
  id: string;
  amount: number;
  date: string;
  source: string;
};

export type PaymentDetail = {
  kind: "expense" | "debt";
  budgetPlanId: string;
  id: string;
  name: string;
  dueAmount: number;
  dueDate: string | null;
  dueDay: number | null;
  overdue: boolean;
  missed: boolean;
  isMissedPayment?: boolean;
  dueLabel?: string;
  paymentsTotal?: number;
  remaining?: number;
  isPaid?: boolean;
  isPartial?: boolean;
  statusTag?: "Missed" | "Overdue" | "Paid" | "Partial" | "Unpaid";
  statusDescription?: string;
  payments: PaymentDetailPayment[];
};

export type PaymentDetailSheetItem = {
  kind: "expense" | "debt";
  id: string;
  name: string;
  dueAmount: number;
  logoUrl?: string | null;
};

export type PaymentDetailSheetProps = {
  visible: boolean;
  insetsBottom: number;
  currency: string;
  item: PaymentDetailSheetItem | null;
  detail: PaymentDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: (item: PaymentDetailSheetItem) => void;
};