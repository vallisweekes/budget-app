import { apiFetch } from "@/lib/api";
import type { ExpenseSummary } from "@/lib/apiTypes";
import { buildPayPeriodFromMonthAnchor, getPayPeriodAnchorFromWindow, resolveActivePayPeriod, type PayFrequency } from "@/lib/payPeriods";

export type PeriodAnchor = {
  month: number;
  year: number;
};

function shiftAnchor(anchor: PeriodAnchor, delta: number): PeriodAnchor {
  let month = anchor.month + delta;
  let year = anchor.year;

  while (month > 12) {
    month -= 12;
    year += 1;
  }

  while (month < 1) {
    month += 12;
    year -= 1;
  }

  return { month, year };
}

export async function resolveDisplayedPayPeriodAnchor(params: {
  budgetPlanId: string;
  payDate: number;
  payFrequency: PayFrequency;
  planCreatedAt?: Date | null;
  now?: Date;
}): Promise<PeriodAnchor> {
  const now = params.now ?? new Date();
  const active = resolveActivePayPeriod({
    now,
    payDate: params.payDate,
    payFrequency: params.payFrequency,
    planCreatedAt: params.planCreatedAt,
  });

  const activeAnchor = getPayPeriodAnchorFromWindow({ period: active, payFrequency: params.payFrequency });
  const activePeriod = buildPayPeriodFromMonthAnchor({
    year: activeAnchor.year,
    month: activeAnchor.month,
    payDate: params.payDate,
    payFrequency: params.payFrequency,
  });
  const activePeriodEnd = new Date(activePeriod.end.getTime());
  activePeriodEnd.setHours(23, 59, 59, 999);

  if (now.getTime() > activePeriodEnd.getTime()) {
    return activeAnchor;
  }

  try {
    const summary = await apiFetch<ExpenseSummary>(
      `/api/bff/expenses/summary?month=${activeAnchor.month}&year=${activeAnchor.year}&scope=pay_period&budgetPlanId=${encodeURIComponent(params.budgetPlanId)}`,
      { cacheTtlMs: 0 },
    );

    const hasOutstanding = Number(summary?.unpaidCount ?? 0) > 0;
    if (hasOutstanding) {
      return activeAnchor;
    }

    return shiftAnchor(activeAnchor, 1);
  } catch {
    return activeAnchor;
  }
}
