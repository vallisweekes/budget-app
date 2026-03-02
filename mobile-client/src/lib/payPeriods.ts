import { MONTH_NAMES_SHORT } from "@/lib/formatting";

export type PayFrequency = "monthly" | "every_2_weeks" | "weekly";

export function normalizePayFrequency(value: unknown): PayFrequency {
  if (value === "weekly" || value === "every_2_weeks") return value;
  return "monthly";
}

function clampDay(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(Math.max(1, Math.floor(day)), lastDay));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function dayWindowForFrequency(payFrequency: PayFrequency): number {
  if (payFrequency === "weekly") return 7;
  if (payFrequency === "every_2_weeks") return 14;
  return 0;
}

export function resolveActivePayPeriod(params: {
  now?: Date;
  payDate: number;
  payFrequency: PayFrequency;
}): { start: Date; end: Date } {
  const now = params.now ?? new Date();
  const payDate = Number.isFinite(params.payDate) && params.payDate >= 1 ? Math.floor(params.payDate) : 1;
  const payFrequency = params.payFrequency;

  if (payFrequency === "monthly") {
    const thisMonthPayDate = clampDay(now.getFullYear(), now.getMonth(), payDate);
    const start = now.getTime() >= thisMonthPayDate.getTime()
      ? thisMonthPayDate
      : clampDay(now.getFullYear(), now.getMonth() - 1, payDate);
    const end = clampDay(start.getFullYear(), start.getMonth() + 1, payDate);
    end.setDate(end.getDate() - 1);
    return { start, end };
  }

  const span = dayWindowForFrequency(payFrequency);
  const thisMonthAnchor = clampDay(now.getFullYear(), now.getMonth(), payDate);
  let start = now.getTime() >= thisMonthAnchor.getTime()
    ? thisMonthAnchor
    : clampDay(now.getFullYear(), now.getMonth() - 1, payDate);
  let end = addDays(start, span - 1);

  while (now.getTime() > end.getTime()) {
    start = addDays(start, span);
    end = addDays(start, span - 1);
  }

  while (now.getTime() < start.getTime()) {
    start = addDays(start, -span);
    end = addDays(start, span - 1);
  }

  return { start, end };
}

export function buildPayPeriodFromMonthAnchor(params: {
  year: number;
  month: number;
  payDate: number;
  payFrequency: PayFrequency;
}): { start: Date; end: Date } {
  const payDate = Number.isFinite(params.payDate) && params.payDate >= 1 ? Math.floor(params.payDate) : 1;

  if (params.payFrequency === "monthly") {
    const start = clampDay(params.year, params.month - 2, payDate);
    const end = clampDay(params.year, params.month - 1, payDate);
    end.setDate(end.getDate() - 1);
    return { start, end };
  }

  const span = dayWindowForFrequency(params.payFrequency);
  const start = clampDay(params.year, params.month - 1, payDate);
  const end = addDays(start, span - 1);
  return { start, end };
}

export function formatPayPeriodLabel(start: Date, end: Date): string {
  return `${start.getDate()} ${MONTH_NAMES_SHORT[start.getMonth()]} - ${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]}`;
}
