import { MONTH_NAMES_SHORT } from "@/lib/formatting";

export type PayFrequency = "monthly" | "every_2_weeks" | "weekly";

export function normalizePayFrequency(value: unknown): PayFrequency {
  if (value === "weekly" || value === "every_2_weeks") return value;
  return "monthly";
}

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
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

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftMonthYear(params: { year: number; month: number; delta: number }): { year: number; month: number } {
  const safeMonth = Math.max(1, Math.min(12, Math.floor(params.month)));
  const safeYear = Math.floor(params.year);
  const absoluteMonth = (safeYear * 12) + (safeMonth - 1) + params.delta;
  const year = Math.floor(absoluteMonth / 12);
  const month = (absoluteMonth % 12) + 1;
  return { year, month };
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
  planCreatedAt?: Date | null;
}): { start: Date; end: Date } {
  const now = params.now ?? new Date();
  const payDate = Number.isFinite(params.payDate) && params.payDate >= 1 ? Math.floor(params.payDate) : 1;
  const payFrequency = params.payFrequency;
  const planCreatedAt = params.planCreatedAt;

  if (payFrequency === "monthly") {
    const thisMonthPayDate = clampDay(now.getFullYear(), now.getMonth(), payDate);
    const previousMonthPayDate = clampDay(now.getFullYear(), now.getMonth() - 1, payDate);
    if (
      isValidDate(planCreatedAt) &&
      now.getTime() < thisMonthPayDate.getTime() &&
      planCreatedAt.getTime() > previousMonthPayDate.getTime() &&
      planCreatedAt.getTime() <= now.getTime()
    ) {
      const end = clampDay(thisMonthPayDate.getFullYear(), thisMonthPayDate.getMonth() + 1, payDate);
      end.setDate(end.getDate() - 1);
      return { start: thisMonthPayDate, end };
    }
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

export function getPayPeriodAnchorFromWindow(params: {
  period: { start: Date; end: Date };
  payFrequency: PayFrequency;
}): { month: number; year: number } {
  const { period, payFrequency } = params;

  if (payFrequency === "monthly") {
    return {
      month: period.end.getMonth() + 1,
      year: period.end.getFullYear(),
    };
  }

  return {
    month: period.start.getMonth() + 1,
    year: period.start.getFullYear(),
  };
}

export function getPayPeriodAnchorFromSelection(params: {
  year: number;
  month: number;
  payFrequency: PayFrequency;
}): { year: number; month: number } {
  if (params.payFrequency === "monthly") {
    return shiftMonthYear({ year: params.year, month: params.month, delta: 1 });
  }

  return {
    year: Math.floor(params.year),
    month: Math.max(1, Math.min(12, Math.floor(params.month))),
  };
}

export function getPayPeriodSelectionFromAnchor(params: {
  year: number;
  month: number;
  payFrequency: PayFrequency;
}): { year: number; month: number } {
  if (params.payFrequency === "monthly") {
    return shiftMonthYear({ year: params.year, month: params.month, delta: -1 });
  }

  return {
    year: Math.floor(params.year),
    month: Math.max(1, Math.min(12, Math.floor(params.month))),
  };
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

export function getPayPeriodRangeLabelFromAnchor(params: {
  year: number;
  month: number;
  payDate: number;
  payFrequency: PayFrequency;
}): string {
  const period = buildPayPeriodFromMonthAnchor({
    year: params.year,
    month: params.month,
    payDate: params.payDate,
    payFrequency: params.payFrequency,
  });
  return formatPayPeriodLabel(period.start, period.end);
}

export function getPayPeriodRangeLabelFromSelection(params: {
  year: number;
  month: number;
  payDate: number;
  payFrequency: PayFrequency;
}): string {
  const anchor = getPayPeriodAnchorFromSelection({
    year: params.year,
    month: params.month,
    payFrequency: params.payFrequency,
  });

  return getPayPeriodRangeLabelFromAnchor({
    year: anchor.year,
    month: anchor.month,
    payDate: params.payDate,
    payFrequency: params.payFrequency,
  });
}

export function getPayPeriodWindowFromPeriodKey(params: {
  periodKey: string;
  payDate: number;
  payFrequency: PayFrequency;
}): { start: Date; end: Date } {
  const start = new Date(`${params.periodKey}T00:00:00`);
  if (!Number.isFinite(start.getTime())) {
    throw new Error(`Invalid periodKey: ${params.periodKey}`);
  }

  if (params.payFrequency === "monthly") {
    const end = clampDay(start.getFullYear(), start.getMonth() + 1, params.payDate);
    end.setDate(end.getDate() - 1);
    return { start, end };
  }

  const span = dayWindowForFrequency(params.payFrequency);
  return {
    start,
    end: addDays(start, span - 1),
  };
}

export function getPayPeriodLabelFromPeriodKey(params: {
  periodKey: string;
  payDate: number;
  payFrequency: PayFrequency;
}): string {
  const { start, end } = getPayPeriodWindowFromPeriodKey(params);
  return formatPayPeriodLabel(start, end);
}

export function getPayPeriodKeyForDate(date: Date): string {
  return toLocalDateKey(date);
}

export function buildUpcomingPayPeriodOptions(params: {
  fromDate?: Date;
  fromPeriodKey?: string | null;
  count: number;
  payDate: number;
  payFrequency: PayFrequency;
}): Array<{ periodKey: string; label: string }> {
  const count = Math.max(0, Math.trunc(params.count));
  if (count === 0) return [];

  let start = (() => {
    if (typeof params.fromPeriodKey === "string" && params.fromPeriodKey) {
      const parsed = new Date(`${params.fromPeriodKey}T00:00:00`);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }
    return resolveActivePayPeriod({
      now: params.fromDate ?? new Date(),
      payDate: params.payDate,
      payFrequency: params.payFrequency,
    }).start;
  })();

  const options: Array<{ periodKey: string; label: string }> = [];

  for (let index = 0; index < count; index += 1) {
    const periodKey = toLocalDateKey(start);
    const { end } = getPayPeriodWindowFromPeriodKey({
      periodKey,
      payDate: params.payDate,
      payFrequency: params.payFrequency,
    });
    options.push({
      periodKey,
      label: formatPayPeriodLabel(start, end),
    });

    if (params.payFrequency === "monthly") {
      start = clampDay(start.getFullYear(), start.getMonth() + 1, params.payDate);
    } else {
      start = addDays(start, dayWindowForFrequency(params.payFrequency));
    }
  }

  return options;
}
