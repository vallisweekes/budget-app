import { useEffect, useMemo } from "react";

import type { DashboardData, Goal, Settings } from "@/lib/apiTypes";
import { apiFetch } from "@/lib/api";
import { GOALS_PREFETCH_CACHE_TTL_MS } from "@/lib/constants";
import { getActiveAnalyticsAnchor, getPreviousAnalyticsAnchor } from "@/lib/helpers/analytics";
import { useAppDispatch } from "@/store";
import { mobileApi } from "@/store/api";

const warmedDashboardKeys = new Set<string>();

type UsePostDashboardWarmupParams = {
  dashboard: DashboardData | null;
  settings: Settings | null;
  isFocused: boolean;
};

export function usePostDashboardWarmup({ dashboard, settings, isFocused }: UsePostDashboardWarmupParams) {
  const dispatch = useAppDispatch();
  const activeAnchor = useMemo(
    () => getActiveAnalyticsAnchor(dashboard?.monthNum, dashboard?.year),
    [dashboard?.monthNum, dashboard?.year],
  );
  const previousAnchor = useMemo(
    () => getPreviousAnalyticsAnchor(activeAnchor),
    [activeAnchor],
  );
  const budgetPlanId = typeof settings?.id === "string" && settings.id.trim()
    ? settings.id.trim()
    : (typeof dashboard?.budgetPlanId === "string" ? dashboard.budgetPlanId.trim() : "");
  const warmupKey = useMemo(() => {
    if (!isFocused || !dashboard || !budgetPlanId) return "";
    return `${budgetPlanId}:${activeAnchor.year}:${activeAnchor.month}`;
  }, [activeAnchor.month, activeAnchor.year, budgetPlanId, dashboard, isFocused]);

  useEffect(() => {
    if (!warmupKey || warmedDashboardKeys.has(warmupKey)) {
      return;
    }

    warmedDashboardKeys.add(warmupKey);

    const prefetches = [
      dispatch(mobileApi.endpoints.getDebtSummary.initiate(undefined, { subscribe: false })),
      dispatch(mobileApi.endpoints.getCreditCards.initiate(undefined, { subscribe: false })),
      dispatch(mobileApi.endpoints.getIncomeSummary.initiate(activeAnchor.year, { subscribe: false })),
      dispatch(mobileApi.endpoints.getAnalyticsExpenseSeries.initiate({
        year: activeAnchor.year,
        budgetPlanId,
      }, { subscribe: false })),
      dispatch(mobileApi.endpoints.getExpenseSummary.initiate({
        month: activeAnchor.month,
        year: activeAnchor.year,
        budgetPlanId,
        scope: "pay_period",
      }, { subscribe: false })),
      dispatch(mobileApi.endpoints.getExpenseSummary.initiate({
        month: previousAnchor.month,
        year: previousAnchor.year,
        budgetPlanId,
        scope: "pay_period",
      }, { subscribe: false })),
    ];

    void Promise.allSettled([
      ...prefetches.map((prefetch) => prefetch.unwrap()),
      apiFetch<Goal[]>(`/api/bff/goals?budgetPlanId=${encodeURIComponent(budgetPlanId)}`, {
        cacheTtlMs: GOALS_PREFETCH_CACHE_TTL_MS,
      }),
    ]);
  }, [activeAnchor.month, activeAnchor.year, budgetPlanId, dispatch, previousAnchor.month, previousAnchor.year, warmupKey]);
}