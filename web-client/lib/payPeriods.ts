export type PayFrequency = "monthly" | "every_2_weeks" | "weekly";
export type BillFrequency = "monthly" | "every_2_weeks";

export function normalizePayFrequency(value: unknown): PayFrequency {
  if (value === "weekly" || value === "every_2_weeks") return value;
  return "monthly";
}

export function normalizeBillFrequency(value: unknown): BillFrequency {
  if (value === "every_2_weeks") return value;
  return "monthly";
}

function intervalDays(payFrequency: PayFrequency): number {
  if (payFrequency === "weekly") return 7;
  if (payFrequency === "every_2_weeks") return 14;
  return 0;
}

function clampDayUtc(year: number, monthIndex: number, day: number): Date {
  const maxDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const clamped = Math.max(1, Math.min(maxDay, Math.floor(day)));
  return new Date(Date.UTC(year, monthIndex, clamped));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function resolveActivePayPeriodWindow(params: {
  now: Date;
  payDate: number;
  payFrequency: PayFrequency;
}): { start: Date; end: Date } {
  const { now, payDate, payFrequency } = params;

  if (payFrequency === "monthly") {
    const thisMonthPayDate = clampDayUtc(now.getUTCFullYear(), now.getUTCMonth(), payDate);
    const start = now.getTime() >= thisMonthPayDate.getTime()
      ? thisMonthPayDate
      : clampDayUtc(now.getUTCFullYear(), now.getUTCMonth() - 1, payDate);
    const end = clampDayUtc(start.getUTCFullYear(), start.getUTCMonth() + 1, payDate);
    end.setUTCDate(end.getUTCDate() - 1);
    return { start, end };
  }

  const step = intervalDays(payFrequency);
  const thisMonthAnchor = clampDayUtc(now.getUTCFullYear(), now.getUTCMonth(), payDate);
  let start = now.getTime() >= thisMonthAnchor.getTime()
    ? thisMonthAnchor
    : clampDayUtc(now.getUTCFullYear(), now.getUTCMonth() - 1, payDate);
  let end = addUtcDays(start, step - 1);

  while (now.getTime() > end.getTime()) {
    start = addUtcDays(start, step);
    end = addUtcDays(start, step - 1);
  }

  while (now.getTime() < start.getTime()) {
    start = addUtcDays(start, -step);
    end = addUtcDays(start, step - 1);
  }

  return { start, end };
}

export function buildPayPeriodFromMonthAnchor(params: {
  anchorYear: number;
  anchorMonth: number;
  payDate: number;
  payFrequency: PayFrequency;
}): { start: Date; end: Date } {
  const { anchorYear, anchorMonth, payDate, payFrequency } = params;

  if (payFrequency === "monthly") {
    const start = clampDayUtc(anchorYear, anchorMonth - 2, payDate);
    const end = clampDayUtc(anchorYear, anchorMonth - 1, payDate);
    end.setUTCDate(end.getUTCDate() - 1);
    return { start, end };
  }

  const step = intervalDays(payFrequency);
  const start = clampDayUtc(anchorYear, anchorMonth - 1, payDate);
  const end = addUtcDays(start, step - 1);
  return { start, end };
}
