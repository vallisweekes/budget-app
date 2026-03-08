import type { ExpenseFrequencyPointStatus, ExpenseFrequencyResponse } from "@/lib/apiTypes";
import { getApiBaseUrl } from "@/lib/api";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import type { MonthPoint } from "@/screens/expenseDetail/types";

export const PAYMENT_EDIT_GRACE_DAYS = 5;
const PAYMENT_EDIT_GRACE_MS = PAYMENT_EDIT_GRACE_DAYS * 24 * 60 * 60 * 1000;

export function isWithinPaymentEditGrace(lastPaymentAt: string | null | undefined): boolean {
  if (!lastPaymentAt) return false;
  const parsed = new Date(lastPaymentAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() <= PAYMENT_EDIT_GRACE_MS;
}

export function getPaymentStatusGraceNote(lastPaymentAt: string | null | undefined): string {
  if (!lastPaymentAt) return `Can change status for ${PAYMENT_EDIT_GRACE_DAYS} days only.`;
  const parsed = new Date(lastPaymentAt);
  if (Number.isNaN(parsed.getTime())) return `Can change status for ${PAYMENT_EDIT_GRACE_DAYS} days only.`;
  const deadlineMs = parsed.getTime() + PAYMENT_EDIT_GRACE_MS;
  const remainingMs = Math.max(0, deadlineMs - Date.now());
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (remainingMs <= oneDayMs) return "Today is the last day to change status.";
  if (remainingMs <= oneDayMs * 2) return "Tomorrow is the last day to change status.";
  return `Can change status for ${PAYMENT_EDIT_GRACE_DAYS} days only.`;
}

export function monthLabel(month: number): string {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return labels[Math.max(1, Math.min(12, month)) - 1] ?? "";
}

export function monthYearLabel(month: number, year: number): string {
  return `${monthLabel(month)} ${year}`;
}

export function buildExpenseTips(params: {
  displayName: string;
  currency: string;
  amountNum: number;
  remainingNum: number;
  isPaid: boolean;
  dueDays: number | null;
  isDirectDebit: boolean;
  month: number;
  year: number;
  points: MonthPoint[];
  subtitle: string;
  missedBefore: boolean;
  debt: ExpenseFrequencyResponse["debt"] | undefined;
  indicator: { label: string } | null;
}): string[] {
  const { displayName, currency, amountNum, remainingNum, isPaid, dueDays, isDirectDebit, month, year, points, subtitle, missedBefore, debt, indicator } = params;
  const tips: string[] = [];
  const current = { month, year };
  const history = points.filter((point) => compareMonthYear({ month: point.month, year: point.year }, current) <= 0);
  const future = points.filter((point) => compareMonthYear({ month: point.month, year: point.year }, current) > 0);
  const nextMonth = future[0] ? { month: future[0].month, year: future[0].year } : null;
  const counts = history.reduce((acc, point) => {
    acc.total += 1;
    if (point.status === "paid") acc.paid += 1;
    else if (point.status === "partial") acc.partial += 1;
    else if (point.status === "unpaid") acc.unpaid += 1;
    else if (point.status === "missed") acc.missed += 1;
    return acc;
  }, { total: 0, paid: 0, partial: 0, unpaid: 0, missed: 0 });
  const currentPoint = points.find((point) => point.month === month && point.year === year) ?? null;
  if (counts.total > 0) {
    const quality = indicator?.label ? ` (${indicator.label})` : "";
    tips.push(`${subtitle}${quality}: last ${counts.total} months — ${counts.paid} paid, ${counts.partial} partial, ${counts.unpaid} unpaid, ${counts.missed} missed.`);
  } else {
    tips.push(`${displayName}: add a couple of months of history to unlock better tips.`);
  }
  if (isPaid) {
    tips.push(`Fully paid for ${monthYearLabel(month, year)}. If you want it to feel easier next time, start next month early: ${fmt(amountNum / 4, currency)} per week.`);
  } else {
    tips.push(`You’re ${fmt(remainingNum, currency)} away from fully paid.`);
  }
  if (!isPaid && remainingNum > 0.005) {
    if (dueDays == null) tips.push("Add a due date to get better reminders + a smarter payment spread.");
    else if (dueDays < 0) tips.push("It’s overdue — recording even a small payment can prevent this becoming a missed month.");
    else if (dueDays <= 7) tips.push(`Due soon (${dueDays} days). A reasonable spread is about ${fmt(remainingNum / Math.max(1, dueDays), currency)} per day until it’s cleared.`);
    else {
      const weeks = Math.max(1, Math.min(4, Math.ceil(Math.min(dueDays, 28) / 7)));
      tips.push(`You’ve got ${dueDays} days. A simple spread: ${fmt(remainingNum / weeks, currency)} per week for ${weeks} week${weeks === 1 ? "" : "s"}.`);
    }
  }
  if (!isDirectDebit) {
    tips.push(missedBefore ? "You’ve missed this in prior months — consider Direct Debit / Standing Order so it doesn’t depend on memory." : "If this repeats monthly, enabling Direct Debit can reduce the mental load.");
  } else {
    tips.push("Direct Debit is enabled — double-check the due date so it’s always funded in time.");
  }
  if (currentPoint && !isPaid) {
    if (currentPoint.status === "partial") tips.push("This month is part-paid so far — topping up now avoids a last-minute scramble.");
    else if (currentPoint.status === "upcoming" || currentPoint.status === "unpaid") {
      if (dueDays != null && dueDays >= 0) tips.push(`Upcoming payment in ${dueDays} day${dueDays === 1 ? "" : "s"} — adding a small payment now keeps things smooth.`);
      else if (dueDays != null && dueDays >= -5) tips.push(`Payment was due ${Math.abs(dueDays)} day${Math.abs(dueDays) === 1 ? "" : "s"} ago — you’re still within the grace window. A quick payment now avoids a missed month.`);
      else tips.push("Payment is overdue — even a small chip-in now helps recover this month quickly.");
    } else if (currentPoint.status === "missed") tips.push("This month is marked missed — record a payment now to get back on track.");
  }
  if (debt?.hasDebt && !debt.cleared) {
    const activeBalance = typeof debt.activeBalance === "number" ? debt.activeBalance : null;
    const monthHint = nextMonth ? monthYearLabel(nextMonth.month, nextMonth.year) : "next month";
    tips.push(`Linked debt: ${debt.activeCount ?? 0} active. After this bill is covered, ${monthHint} is a good target to overpay the debt${activeBalance && activeBalance > 0.005 ? ` (about ${fmt(activeBalance, currency)} remaining).` : "."}`);
  } else if (debt?.hasDebt && debt.cleared) tips.push("Good news — linked debt looks cleared. You can keep payments consistent to avoid it building back up.");
  return tips.map((tip) => tip.trim()).filter(Boolean);
}

export function clampDay(year: number, monthIndex: number, day: number): Date {
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(Math.max(1, day), maxDay));
}

export function buildPeriodLabels(month: number, year: number, payDate: number | null | undefined) {
  const safePayDate = Number.isFinite(payDate as number) && (payDate as number) >= 1 ? Math.floor(payDate as number) : 27;
  const start = clampDay(year, month - 2, safePayDate);
  const end = clampDay(year, month - 1, safePayDate);
  end.setDate(end.getDate() - 1);
  return {
    span: `${monthLabel(start.getMonth() + 1)} - ${monthLabel(end.getMonth() + 1)}`,
    range: `${start.getDate()} ${monthLabel(start.getMonth() + 1)} - ${end.getDate()} ${monthLabel(end.getMonth() + 1)}`,
  };
}

export function nextNMonths(fromMonth: number, fromYear: number, count: number): Array<{ month: number; year: number }> {
  const out: Array<{ month: number; year: number }> = [];
  let month = fromMonth;
  let year = fromYear;
  for (let index = 0; index < count; index += 1) {
    out.push({ month, year });
    month += 1;
    if (month >= 13) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

export function addMonths(fromMonth: number, fromYear: number, delta: number): { month: number; year: number } {
  let month = fromMonth;
  let year = fromYear;
  for (let index = 0; index < Math.abs(delta); index += 1) {
    if (delta >= 0) {
      month += 1;
      if (month >= 13) { month = 1; year += 1; }
    } else {
      month -= 1;
      if (month <= 0) { month = 12; year -= 1; }
    }
  }
  return { month, year };
}

export function compareMonthYear(a: { month: number; year: number }, b: { month: number; year: number }): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function statusLabel(status: ExpenseFrequencyPointStatus): string {
  switch (status) {
    case "paid": return "Paid";
    case "partial": return "Part";
    case "unpaid": return "Unpaid";
    case "missed": return "Missed";
    case "upcoming": return "Next";
    default: return "";
  }
}

export function indicatorLabel(kind: "good" | "moderate" | "bad"): string {
  return kind === "good" ? "Good" : kind === "bad" ? "Bad" : "Moderate";
}

export function resolveLogoUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith("/")) return null;
  try { return `${getApiBaseUrl()}${raw}`; } catch { return null; }
}

export function formatDMY(value: Date): string {
  const dd = String(value.getDate()).padStart(2, "0");
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const yyyy = String(value.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function isoLikeToDMY(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatUpdatedLabel(lastPaymentAt: string | null | undefined): string {
  if (!lastPaymentAt) return "No payment made";
  const direct = isoLikeToDMY(String(lastPaymentAt));
  if (direct) return direct;
  const parsed = new Date(String(lastPaymentAt));
  if (Number.isNaN(parsed.getTime())) return "No payment made";
  return formatDMY(parsed);
}

export function formatDueDateLabel(isoOrYmd: string | null | undefined): string {
  if (!isoOrYmd) return "No due date";
  const iso = String(isoOrYmd).length >= 10 ? String(isoOrYmd).slice(0, 10) : String(isoOrYmd);
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function dueDateColor(isoOrYmd: string | null | undefined): string {
  if (!isoOrYmd) return T.textMuted;
  const iso = String(isoOrYmd).length >= 10 ? String(isoOrYmd).slice(0, 10) : String(isoOrYmd);
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return T.textMuted;
  const days = Math.round((parsed.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return T.red;
  if (days <= 5) return T.orange;
  return T.green;
}

export function unpaidDebtWarning(daysUntilDue: number | null): string {
  if (daysUntilDue == null) return "Making this unpaid can eventually turn this payment into debt if it is not marked as paid again.";
  if (daysUntilDue <= 0) return "Making this unpaid means this payment is overdue and could turn into debt quickly if it is not marked as paid again.";
  if (daysUntilDue === 1) return "Making this unpaid could eventually make this payment a debt if it is not marked as paid in 1 day.";
  return `Making this unpaid could eventually make this payment a debt if it is not marked as paid in ${daysUntilDue} days.`;
}