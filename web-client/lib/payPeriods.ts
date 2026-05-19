export type PayFrequency = "monthly" | "every_2_weeks" | "every_4_weeks" | "weekly";
export type BillFrequency = "monthly" | "every_2_weeks";

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizePayFrequency(value: unknown): PayFrequency {
  if (value === "weekly" || value === "every_2_weeks" || value === "every_4_weeks") return value;
  return "monthly";
}

export function normalizeBillFrequency(value: unknown): BillFrequency {
  if (value === "every_2_weeks") return value;
  return "monthly";
}

function intervalDays(payFrequency: PayFrequency): number {
  if (payFrequency === "weekly") return 7;
  if (payFrequency === "every_2_weeks") return 14;
  if (payFrequency === "every_4_weeks") return 28;
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

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parsePayAnchorDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const parsed = value instanceof Date
    ? new Date(value.getTime())
    : typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
      ? new Date(`${value.trim()}T00:00:00.000Z`)
      : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) return null;
  return startOfUtcDay(parsed);
}

function resolveAnchoredIntervalStart(params: {
  date: Date;
  payAnchorDate: Date;
  step: number;
}): Date {
  const target = startOfUtcDay(params.date);
  const anchor = startOfUtcDay(params.payAnchorDate);
  const diffDays = Math.floor((target.getTime() - anchor.getTime()) / DAY_MS);
  return addUtcDays(anchor, Math.floor(diffDays / params.step) * params.step);
}

function resolveAnchoredMonthStart(params: {
  anchorYear: number;
  anchorMonth: number;
  payAnchorDate: Date;
  step: number;
}): Date {
  const targetStart = new Date(Date.UTC(params.anchorYear, params.anchorMonth - 1, 1));
  const targetEnd = new Date(Date.UTC(params.anchorYear, params.anchorMonth, 0));
  const anchor = startOfUtcDay(params.payAnchorDate);
  const diffDays = Math.floor((targetStart.getTime() - anchor.getTime()) / DAY_MS);
  let candidate = addUtcDays(anchor, Math.floor(diffDays / params.step) * params.step);

  while (candidate.getTime() < targetStart.getTime()) {
    candidate = addUtcDays(candidate, params.step);
  }

  const candidates: Date[] = [];
  let cursor = candidate;
  while (cursor.getTime() <= targetEnd.getTime()) {
    candidates.push(cursor);
    cursor = addUtcDays(cursor, params.step);
  }

  if (candidates.length === 0) {
    return candidate;
  }

  const referenceDay = anchor.getUTCDate();
  return candidates.reduce((best, current) => {
    const bestDistance = Math.abs(best.getUTCDate() - referenceDay);
    const currentDistance = Math.abs(current.getUTCDate() - referenceDay);
    if (currentDistance !== bestDistance) {
      return currentDistance < bestDistance ? current : best;
    }
    return current.getTime() < best.getTime() ? current : best;
  });
}

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function shouldUseFirstAnchoredInterval(params: {
  now: Date;
  planCreatedAt?: Date | null;
  anchoredPayDate: Date;
  step: number;
}): boolean {
  if (!isValidDate(params.planCreatedAt)) return false;

  const planStart = startOfUtcDay(params.planCreatedAt);
  if (params.now.getTime() >= params.anchoredPayDate.getTime()) return false;
  if (planStart.getTime() > params.now.getTime()) return false;

  const diffDays = Math.floor((planStart.getTime() - params.anchoredPayDate.getTime()) / DAY_MS);
  return Math.abs(diffDays) < params.step;
}

export function resolveActivePayPeriodWindow(params: {
  now: Date;
  payDate: number;
  payFrequency: PayFrequency;
  payAnchorDate?: Date | string | null;
  planCreatedAt?: Date | null;
}): { start: Date; end: Date } {
  const { now, payDate, payFrequency, planCreatedAt } = params;

  if (payFrequency === "monthly") {
    const thisMonthPayDate = clampDayUtc(now.getUTCFullYear(), now.getUTCMonth(), payDate);
    const previousMonthPayDate = clampDayUtc(now.getUTCFullYear(), now.getUTCMonth() - 1, payDate);
    if (
      isValidDate(planCreatedAt) &&
      now.getTime() < thisMonthPayDate.getTime() &&
      planCreatedAt.getTime() > previousMonthPayDate.getTime() &&
      planCreatedAt.getTime() <= now.getTime()
    ) {
      const end = clampDayUtc(thisMonthPayDate.getUTCFullYear(), thisMonthPayDate.getUTCMonth() + 1, payDate);
      end.setUTCDate(end.getUTCDate() - 1);
      return { start: thisMonthPayDate, end };
    }
    const start = now.getTime() >= thisMonthPayDate.getTime()
      ? thisMonthPayDate
      : clampDayUtc(now.getUTCFullYear(), now.getUTCMonth() - 1, payDate);
    const end = clampDayUtc(start.getUTCFullYear(), start.getUTCMonth() + 1, payDate);
    end.setUTCDate(end.getUTCDate() - 1);
    return { start, end };
  }

  const step = intervalDays(payFrequency);
  const anchoredPayDate = parsePayAnchorDate(params.payAnchorDate);
  if (anchoredPayDate) {
    if (shouldUseFirstAnchoredInterval({ now, planCreatedAt, anchoredPayDate, step })) {
      return { start: anchoredPayDate, end: addUtcDays(anchoredPayDate, step - 1) };
    }

    const start = resolveAnchoredIntervalStart({
      date: now,
      payAnchorDate: anchoredPayDate,
      step,
    });
    return { start, end: addUtcDays(start, step - 1) };
  }
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

export function resolveFirstSelectablePayPeriodWindow(params: {
  payDate: number;
  payFrequency: PayFrequency;
  payAnchorDate?: Date | string | null;
  planStartAt?: Date | null;
}): { start: Date; end: Date } {
  const safePayDate = Number.isFinite(params.payDate) && params.payDate >= 1 ? Math.floor(params.payDate) : 1;
  const planStartAt = isValidDate(params.planStartAt) ? startOfUtcDay(params.planStartAt) : null;

  if (params.payFrequency !== "monthly") {
    const step = intervalDays(params.payFrequency);
    const anchoredPayDate = parsePayAnchorDate(params.payAnchorDate);
    if (anchoredPayDate) {
      if (!planStartAt) {
        return { start: anchoredPayDate, end: addUtcDays(anchoredPayDate, step - 1) };
      }

      const diffDays = Math.floor((planStartAt.getTime() - anchoredPayDate.getTime()) / DAY_MS);
      if (Math.abs(diffDays) < step) {
        return { start: anchoredPayDate, end: addUtcDays(anchoredPayDate, step - 1) };
      }
    }
  }

  const referenceDate = planStartAt ?? startOfUtcDay(new Date());
  return resolveActivePayPeriodWindow({
    now: referenceDate,
    payDate: safePayDate,
    payFrequency: params.payFrequency,
    payAnchorDate: params.payAnchorDate,
    planCreatedAt: planStartAt,
  });
}

export function getPayPeriodAnchorFromWindow(params: {
  window: { start: Date; end: Date };
  payFrequency: PayFrequency;
}): { anchorMonth: number; anchorYear: number } {
  const { window, payFrequency } = params;

  if (payFrequency === "monthly") {
    return {
      anchorMonth: window.end.getUTCMonth() + 1,
      anchorYear: window.end.getUTCFullYear(),
    };
  }

  return {
    anchorMonth: window.start.getUTCMonth() + 1,
    anchorYear: window.start.getUTCFullYear(),
  };
}

export function buildPayPeriodFromMonthAnchor(params: {
  anchorYear: number;
  anchorMonth: number;
  payDate: number;
  payFrequency: PayFrequency;
  payAnchorDate?: Date | string | null;
}): { start: Date; end: Date } {
  const { anchorYear, anchorMonth, payDate, payFrequency } = params;

  if (payFrequency === "monthly") {
    const start = clampDayUtc(anchorYear, anchorMonth - 2, payDate);
    const end = clampDayUtc(anchorYear, anchorMonth - 1, payDate);
    end.setUTCDate(end.getUTCDate() - 1);
    return { start, end };
  }

  const step = intervalDays(payFrequency);
  const anchoredPayDate = parsePayAnchorDate(params.payAnchorDate);
  const start = anchoredPayDate
    ? resolveAnchoredMonthStart({
        anchorYear,
        anchorMonth,
        payAnchorDate: anchoredPayDate,
        step,
      })
    : clampDayUtc(anchorYear, anchorMonth - 1, payDate);
  const end = addUtcDays(start, step - 1);
  return { start, end };
}

export function formatPayPeriodLabelForFrequency(params: {
  start: Date;
  end: Date;
  payFrequency: PayFrequency;
}): string {
  const displayEnd = params.payFrequency === "monthly"
    ? params.end
    : addUtcDays(params.start, intervalDays(params.payFrequency));
  return `${params.start.getUTCDate()} ${params.start.toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  })} - ${displayEnd.getUTCDate()} ${displayEnd.toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  })}`;
}

export function getPayPeriodWindowFromPeriodKey(params: {
  periodKey: string;
  payDate: number;
  payFrequency: PayFrequency;
}): { start: Date; end: Date } {
  const start = new Date(`${params.periodKey}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime())) {
    throw new Error(`Invalid periodKey: ${params.periodKey}`);
  }

  if (params.payFrequency === "monthly") {
    const end = clampDayUtc(start.getUTCFullYear(), start.getUTCMonth() + 1, params.payDate);
    end.setUTCDate(end.getUTCDate() - 1);
    return { start, end };
  }

  const step = intervalDays(params.payFrequency);
  return {
    start,
    end: addUtcDays(start, step - 1),
  };
}

export function getPayPeriodKeyForDate(params: {
  date: Date;
  payDate: number;
  payFrequency: PayFrequency;
  payAnchorDate?: Date | string | null;
  planCreatedAt?: Date | null;
}): string {
  return resolveActivePayPeriodWindow({
    now: params.date,
    payDate: params.payDate,
    payFrequency: params.payFrequency,
    payAnchorDate: params.payAnchorDate,
    planCreatedAt: params.planCreatedAt,
  }).start.toISOString().slice(0, 10);
}

export function getPreviousPayPeriodKey(params: {
  periodKey: string;
  payDate: number;
  payFrequency: PayFrequency;
  payAnchorDate?: Date | string | null;
  planCreatedAt?: Date | null;
}): string {
  const { start } = getPayPeriodWindowFromPeriodKey({
    periodKey: params.periodKey,
    payDate: params.payDate,
    payFrequency: params.payFrequency,
  });
  const previousDay = addUtcDays(start, -1);
  return getPayPeriodKeyForDate({
    date: previousDay,
    payDate: params.payDate,
    payFrequency: params.payFrequency,
    payAnchorDate: params.payAnchorDate,
    planCreatedAt: params.planCreatedAt,
  });
}
