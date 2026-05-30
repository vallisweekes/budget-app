import type { DashboardData } from "@/lib/apiTypes";
import { buildPayPeriodFromMonthAnchor, getPayPeriodAnchorFromWindow, resolveActivePayPeriod, type PayFrequency } from "@/lib/payPeriods";

export const DISPLAYED_PERIOD_NAV_CACHE_TTL_MS = 15_000;

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
  budgetPlanId?: string;
  payDate: number;
  payAnchorDate?: string | null;
  payFrequency: PayFrequency;
  planCreatedAt?: Date | null;
  dashboard?: DashboardData | null;
  now?: Date;
}): Promise<PeriodAnchor> {
  const now = params.now ?? new Date();
  const active = resolveActivePayPeriod({
    now,
    payDate: params.payDate,
    payAnchorDate: params.payAnchorDate,
    payFrequency: params.payFrequency,
    planCreatedAt: params.planCreatedAt,
  });

  const activeAnchor = getPayPeriodAnchorFromWindow({ period: active, payFrequency: params.payFrequency });
  const activePeriod = buildPayPeriodFromMonthAnchor({
    year: activeAnchor.year,
    month: activeAnchor.month,
    payDate: params.payDate,
    payAnchorDate: params.payAnchorDate,
    payFrequency: params.payFrequency,
  });
  const activePeriodEnd = new Date(activePeriod.end.getTime());
  activePeriodEnd.setHours(23, 59, 59, 999);

  if (now.getTime() > activePeriodEnd.getTime()) {
    return activeAnchor;
  }

  const outstandingCount = (params.dashboard?.categoryData ?? []).reduce((count, category) => {
    const unpaidInCategory = (category.expenses ?? []).reduce((categoryCount, expense) => {
      const amount = Number(expense.amount ?? 0);
      const paidAmount = Number(expense.paidAmount ?? 0);
      return amount - paidAmount > 0.0001 ? categoryCount + 1 : categoryCount;
    }, 0);
    return count + unpaidInCategory;
  }, 0);

  if (outstandingCount > 0) {
    return activeAnchor;
  }

  return shiftAnchor(activeAnchor, 1);
}
