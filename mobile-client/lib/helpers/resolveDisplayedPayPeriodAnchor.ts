import type { DashboardData } from "@/lib/apiTypes";
import { buildPayPeriodFromMonthAnchor, getPayPeriodAnchorFromWindow, resolveActivePayPeriod, type PayFrequency } from "@/lib/payPeriods";

export const DISPLAYED_PERIOD_NAV_CACHE_TTL_MS = 15_000;

export type PeriodAnchor = {
  month: number;
  year: number;
};

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

  return activeAnchor;
}
