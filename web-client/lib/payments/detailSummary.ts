export type PaymentStatusTag = "Missed" | "Overdue" | "Paid" | "Partial" | "Unpaid";

export function formatPaymentDueLabel(input: { dueDate: string | null; dueDay: number | null }): string {
  if (input.dueDate) {
    const parsed = new Date(input.dueDate);
    if (!Number.isNaN(parsed.getTime())) {
      return `Due ${parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    }
  }

  if (typeof input.dueDay === "number" && Number.isFinite(input.dueDay)) {
    return `Due day ${input.dueDay}`;
  }

  return "Due date not set";
}

export function derivePaymentDetailSummary(input: {
  dueAmount: number;
  overdue: boolean;
  missed: boolean;
  isMissedPayment?: boolean;
  payments: Array<{ amount: number }>;
}): {
  paymentsTotal: number;
  remaining: number;
  isPaid: boolean;
  isPartial: boolean;
  statusTag: PaymentStatusTag;
  statusDescription: string;
} {
  const paymentsTotal = input.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const remaining = Math.max(0, input.dueAmount - paymentsTotal);

  const isPaid = input.dueAmount <= 0 ? true : paymentsTotal >= input.dueAmount - 0.005;
  const isPartial = !isPaid && paymentsTotal > 0;
  const missedState = Boolean(input.isMissedPayment || input.missed);

  const statusTag: PaymentStatusTag = missedState
    ? "Missed"
    : input.overdue
      ? "Overdue"
      : isPaid
        ? "Paid"
        : isPartial
          ? "Partial"
          : "Unpaid";

  const statusDescription = missedState
    ? "This payment is marked as missed."
    : input.overdue
      ? "This payment is overdue."
      : isPaid
        ? "This payment is paid in full."
        : isPartial
          ? "This payment has been paid partially."
          : "This payment is not yet paid.";

  return {
    paymentsTotal,
    remaining,
    isPaid,
    isPartial,
    statusTag,
    statusDescription,
  };
}
