export type QuickPaymentActionItem = {
  kind: "expense" | "debt";
  id: string;
  name: string;
  amount: number;
  paidAmount?: number;
  lastPaymentAt?: string | null;
  logoUrl?: string | null;
  dueDate?: string | null;
  subtitle?: string | null;
};

export type QuickPaymentActionSheetProps = {
  visible: boolean;
  item: QuickPaymentActionItem | null;
  currency: string;
  insetsBottom: number;
  onClose: () => void;
  onUpdated: () => void;
};