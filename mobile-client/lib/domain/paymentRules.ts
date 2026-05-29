import type { Debt } from "@/lib/apiTypes";
import { formatPayPeriodLabelForFrequency, normalizePayFrequency, resolveActivePayPeriod } from "@/lib/payPeriods";

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

type FutureExpensePaymentWarningParams = {
  dueDate: string | null | undefined;
  payDate: number | null | undefined;
  payFrequency: unknown;
  payAnchorDate?: string | Date | null;
  planCreatedAt?: string | Date | null;
  now?: Date;
};

type FutureExpensePaymentWarning = {
  title: string;
  description: string;
  periodLabel: string;
};

function startOfLocalDay(value: Date): Date {
  const next = new Date(value.getTime());
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseIsoLikeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : startOfLocalDay(parsed);
}

function parsePlanCreatedAt(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getFutureExpensePaymentWarning(params: FutureExpensePaymentWarningParams): FutureExpensePaymentWarning | null {
  const safePayDate = Number(params.payDate);
  if (!Number.isFinite(safePayDate) || safePayDate < 1) return null;

  const dueDate = parseIsoLikeDate(params.dueDate);
  if (!dueDate) return null;

  const now = startOfLocalDay(params.now ?? new Date());
  const payFrequency = normalizePayFrequency(params.payFrequency);
  const planCreatedAt = parsePlanCreatedAt(params.planCreatedAt);
  const period = resolveActivePayPeriod({
    now: dueDate,
    payDate: safePayDate,
    payFrequency,
    payAnchorDate: params.payAnchorDate,
    planCreatedAt,
  });

  if (now.getTime() >= period.start.getTime()) return null;

  const periodLabel = formatPayPeriodLabelForFrequency({
    start: period.start,
    end: period.end,
    payFrequency,
  });

  return {
    title: "Mark as paid early?",
    description: `This payment is for ${periodLabel}, which starts after your current pay period. Are you sure you want to mark it as paid now?`,
    periodLabel,
  };
}
