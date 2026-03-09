import type { Debt } from "@/lib/apiTypes";

export const PAYMENT_EDIT_GRACE_DAYS = 5;
const PAYMENT_EDIT_GRACE_MS = PAYMENT_EDIT_GRACE_DAYS * 24 * 60 * 60 * 1000;

export function isWithinPaymentEditGrace(lastPaymentAt: string | null | undefined): boolean {
  if (!lastPaymentAt) return false;
  const parsed = new Date(lastPaymentAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() <= PAYMENT_EDIT_GRACE_MS;
}

export function unpaidDebtWarning(daysUntilDue: number | null): string {
  if (daysUntilDue == null) {
    return "Making this unpaid can eventually turn this payment into debt if it is not marked as paid again.";
  }
  if (daysUntilDue <= 0) {
    return "Making this unpaid means this payment is overdue and could turn into debt quickly if it is not marked as paid again.";
  }
  if (daysUntilDue === 1) {
    return "Making this unpaid could eventually make this payment a debt if it is not marked as paid in 1 day.";
  }
  return `Making this unpaid could eventually make this payment a debt if it is not marked as paid in ${daysUntilDue} days.`;
}

export function computeDebtDueAmount(debt: Debt): number {
  const currentBalance = Number.parseFloat(String(debt.currentBalance ?? 0));
  if (!Number.isFinite(currentBalance) || currentBalance <= 0) return 0;

  const installmentMonths = Number.parseInt(String(debt.installmentMonths ?? 0), 10);
  const initialBalance = Number.parseFloat(String((debt as any).initialBalance ?? 0));
  const amount = Number.parseFloat(String((debt as any).amount ?? 0));
  const monthlyMinimum = Number.parseFloat(String(debt.monthlyMinimum ?? 0));

  let planned = 0;
  if (Number.isFinite(installmentMonths) && installmentMonths > 0) {
    const principal = Number.isFinite(initialBalance) && initialBalance > 0 ? initialBalance : currentBalance;
    if (principal > 0) planned = principal / installmentMonths;
  }

  if (!(planned > 0) && Number.isFinite(amount) && amount > 0) planned = amount;
  if (!(planned > 0) && debt.sourceType === "expense") planned = currentBalance;
  if (Number.isFinite(monthlyMinimum) && monthlyMinimum > 0) planned = Math.max(planned, monthlyMinimum);

  planned = Number.isFinite(planned) ? Math.max(0, planned) : 0;
  return Math.min(currentBalance, planned);
}

export function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
