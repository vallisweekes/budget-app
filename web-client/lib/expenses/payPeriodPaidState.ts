type SummaryScope = "month" | "pay_period";

export function isFuturePayPeriodStart(start: Date | null | undefined, nowMs = Date.now()): boolean {
  if (!(start instanceof Date)) return false;
  return start.getTime() > nowMs;
}

export function shouldForceUnpaidForSelectedPeriod(params: {
  scope: SummaryScope;
  selectedPeriodStart: Date | null | undefined;
  nowMs?: number;
}): boolean {
  if (params.scope !== "pay_period") return false;
  return isFuturePayPeriodStart(params.selectedPeriodStart, params.nowMs);
}

export function resolveDisplayedExpensePaidState(params: {
  scope: SummaryScope;
  selectedPeriodStart: Date | null | undefined;
  plannedAmount: number;
  canonicalPaidAmount?: number | null;
  canonicalIsPaid?: boolean | null;
  fallbackPaidAmount?: number | null;
  fallbackIsPaid?: boolean | null;
  nowMs?: number;
}): { paidAmount: number; isPaid: boolean } {
  if (
    shouldForceUnpaidForSelectedPeriod({
      scope: params.scope,
      selectedPeriodStart: params.selectedPeriodStart,
      nowMs: params.nowMs,
    })
  ) {
    return { paidAmount: 0, isPaid: false };
  }

  const rawPaidAmount = Number(
    params.canonicalPaidAmount ?? params.fallbackPaidAmount ?? 0,
  );
  const paidAmount = Number.isFinite(rawPaidAmount)
    ? Math.max(0, params.plannedAmount > 0 ? Math.min(rawPaidAmount, params.plannedAmount) : 0)
    : 0;

  const isPaid = Boolean(params.canonicalIsPaid ?? params.fallbackIsPaid ?? false);
  return { paidAmount, isPaid };
}
