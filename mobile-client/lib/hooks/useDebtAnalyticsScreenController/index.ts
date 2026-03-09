import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute, type RouteProp } from "@react-navigation/native";

import { apiFetch } from "@/lib/api";
import type { DebtSummaryData, DebtSummaryItem, Settings } from "@/lib/apiTypes";
import { assignDebtColors, projectDebtMonths } from "@/lib/helpers/debtAnalytics";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import type { DebtStackParamList } from "@/navigation/types";
import type { DebtAnalyticsControllerState } from "@/types/DebtAnalyticsScreen.types";

type Route = RouteProp<DebtStackParamList, "DebtAnalytics">;

export function useDebtAnalyticsScreenController(): DebtAnalyticsControllerState {
  const route = useRoute<Route>();
  const topContentInset = useTopHeaderOffset(-8);

  const routeDebts = route.params?.debts;
  const routeTotalMonthly = route.params?.totalMonthly;
  const routeCurrency = route.params?.currency;
  const hasRoutePayload = Array.isArray(routeDebts) && typeof routeTotalMonthly === "number" && typeof routeCurrency === "string";

  const [debts, setDebts] = useState<DebtSummaryItem[]>(hasRoutePayload ? routeDebts : []);
  const [totalMonthly, setTotalMonthly] = useState<number>(hasRoutePayload ? routeTotalMonthly : 0);
  const [currency, setCurrency] = useState<string>(hasRoutePayload ? routeCurrency : "£");
  const [loading, setLoading] = useState(!hasRoutePayload);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const [summary, settings] = await Promise.all([
        apiFetch<DebtSummaryData>("/api/bff/debt-summary"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setDebts(summary.debts ?? []);
      setTotalMonthly(summary.totalMonthlyDebtPayments ?? 0);
      setCurrency(settings.currency ?? "£");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasRoutePayload) {
      void load();
    }
  }, [hasRoutePayload, load]);

  const activeDebts = useMemo(
    () => debts.filter((debt) => debt.isActive && !debt.paid && debt.currentBalance > 0).sort((a, b) => b.currentBalance - a.currentBalance),
    [debts],
  );
  const colors = useMemo(() => assignDebtColors(activeDebts), [activeDebts]);
  const total = useMemo(() => activeDebts.reduce((sum, debt) => sum + debt.currentBalance, 0), [activeDebts]);
  const paidTotal = useMemo(() => activeDebts.reduce((sum, debt) => sum + debt.paidAmount, 0), [activeDebts]);
  const debtStats = useMemo(() => activeDebts.map((debt, index) => ({
    debt,
    months: projectDebtMonths(debt, totalMonthly),
    color: colors[index],
    pctPaid: debt.initialBalance > 0 ? ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100 : 0,
  })), [activeDebts, colors, totalMonthly]);
  const ganttItems = useMemo(() => [...debtStats].sort((a, b) => a.months - b.months), [debtStats]);
  const maxMonths = useMemo(() => Math.max(...debtStats.map((item) => item.months), 1), [debtStats]);
  const highestAPR = useMemo(() => [...activeDebts]
    .filter((debt) => (debt.interestRate ?? 0) > 0)
    .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0], [activeDebts]);
  const earliest = ganttItems[0];
  const latest = ganttItems[ganttItems.length - 1];

  return {
    activeDebts,
    colors,
    currency,
    debtStats,
    error,
    ganttItems,
    highestAPR,
    latest,
    loading,
    load,
    maxMonths,
    paidTotal,
    topContentInset,
    total,
    totalMonthly,
    earliest,
  };
}
