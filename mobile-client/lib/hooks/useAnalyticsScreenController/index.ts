import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { currencySymbol } from "@/lib/formatting";
import {
  buildAnalyticsChartData,
  buildAnalyticsInsightRows,
  buildAnalyticsTopTips,
  buildDebtDistribution,
  getActiveAnalyticsAnchor,
  getAnalyticsMonthLabel,
  getPayPeriodLabel,
  getPreviousAnalyticsAnchor,
} from "@/lib/helpers/analytics";
import { useTopHeaderOffset } from "@/hooks";
import { normalizePayFrequency } from "@/lib/payPeriods";
import type { RootStackScreenProps } from "@/navigation/types";
import type { AnalyticsOverviewLinePoint, AnalyticsOverviewMode, AnalyticsScreenControllerState } from "@/types/AnalyticsScreen.types";
import { useGetAnalyticsExpenseSeriesQuery, useGetDebtSummaryQuery, useGetExpenseSummaryQuery, useGetIncomeSummaryQuery } from "@/store/api";

export function useAnalyticsScreenController(
): AnalyticsScreenControllerState {
  const topHeaderOffset = useTopHeaderOffset();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<RootStackScreenProps<"Analytics">["navigation"]>();
  const route = useRoute<RootStackScreenProps<"Analytics">["route"]>();
  const { dashboard, settings, isLoading: bootstrapLoading, refresh: refreshBootstrap } = useBootstrapData();
  const [refreshing, setRefreshing] = useState(false);
  const [overviewWrapWidth, setOverviewWrapWidth] = useState(0);
  const overviewMode: AnalyticsOverviewMode = route.params?.overviewMode === "month" ? "month" : "year";

  useEffect(() => {
    if (route.params?.overviewMode === "month" || route.params?.overviewMode === "year") return;
    navigation.setParams({ overviewMode: "year" });
  }, [navigation, route.params?.overviewMode]);

  const currency = currencySymbol(settings?.currency);
  const activeAnchor = useMemo(() => getActiveAnalyticsAnchor(dashboard?.monthNum, dashboard?.year), [dashboard?.monthNum, dashboard?.year]);
  const previousAnchor = useMemo(() => getPreviousAnalyticsAnchor(activeAnchor), [activeAnchor]);
  const payDate = Number.isFinite(dashboard?.payDate) ? Number(dashboard?.payDate) : (settings?.payDate ?? 1);
  const payFrequency = normalizePayFrequency(dashboard?.payFrequency ?? settings?.payFrequency);

  const currentYearIncomeQuery = useGetIncomeSummaryQuery(activeAnchor.year, { refetchOnMountOrArgChange: true });
  const previousYearIncomeQuery = useGetIncomeSummaryQuery(previousAnchor.year, {
    skip: previousAnchor.year === activeAnchor.year,
    refetchOnMountOrArgChange: true,
  });
  const debtQuery = useGetDebtSummaryQuery(undefined, { refetchOnMountOrArgChange: true });
  const expenseSeriesQuery = useGetAnalyticsExpenseSeriesQuery({
    year: activeAnchor.year,
    budgetPlanId: dashboard?.budgetPlanId ?? null,
  }, { refetchOnMountOrArgChange: true });
  const currentExpenseQuery = useGetExpenseSummaryQuery({
    month: activeAnchor.month,
    year: activeAnchor.year,
    budgetPlanId: dashboard?.budgetPlanId ?? null,
    scope: "pay_period",
  }, { refetchOnMountOrArgChange: true });
  const previousExpenseQuery = useGetExpenseSummaryQuery({
    month: previousAnchor.month,
    year: previousAnchor.year,
    budgetPlanId: dashboard?.budgetPlanId ?? null,
    scope: "pay_period",
  }, { refetchOnMountOrArgChange: true });

  const income = currentYearIncomeQuery.data ?? null;
  const debt = debtQuery.data ?? null;
  const expensesByMonth = expenseSeriesQuery.data ?? Array(12).fill(0);
  const currentYearIncome = currentYearIncomeQuery.data ?? null;
  const previousYearIncome = previousAnchor.year === activeAnchor.year
    ? currentYearIncomeQuery.data ?? null
    : previousYearIncomeQuery.data ?? null;

  const refreshAll = useCallback(async () => {
    try {
      await Promise.all([
        refreshBootstrap({ force: true }),
        debtQuery.refetch(),
        currentYearIncomeQuery.refetch(),
        previousAnchor.year === activeAnchor.year ? Promise.resolve() : previousYearIncomeQuery.refetch(),
        expenseSeriesQuery.refetch(),
        currentExpenseQuery.refetch(),
        previousExpenseQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [activeAnchor.year, currentExpenseQuery, currentYearIncomeQuery, debtQuery, expenseSeriesQuery, previousAnchor.year, previousExpenseQuery, previousYearIncomeQuery, refreshBootstrap]);

  const error = useMemo(() => {
    const nextError = debtQuery.error
      ?? currentYearIncomeQuery.error
      ?? previousYearIncomeQuery.error
      ?? expenseSeriesQuery.error
      ?? currentExpenseQuery.error
      ?? previousExpenseQuery.error;
    if (!nextError) return null;
    return nextError instanceof Error ? nextError.message : "Failed to load analytics";
  }, [currentExpenseQuery.error, currentYearIncomeQuery.error, debtQuery.error, expenseSeriesQuery.error, previousExpenseQuery.error, previousYearIncomeQuery.error]);

  const annualIncomeTotal = useMemo(() => (
    income?.grandTotal ?? (income?.months ?? []).reduce((sum, month) => sum + (month.total ?? 0), 0)
  ), [income?.grandTotal, income?.months]);
  const annualExpenseTotal = useMemo(() => expensesByMonth.reduce((sum, value) => sum + value, 0), [expensesByMonth]);
  const currentMonthIndex = activeAnchor.month - 1;
  const currentMonthLabel = useMemo(() => getAnalyticsMonthLabel(new Date(activeAnchor.year, activeAnchor.month - 1, 1)), [activeAnchor.month, activeAnchor.year]);
  const currentPayPeriodLabel = useMemo(() => getPayPeriodLabel({
    anchor: activeAnchor,
    dashboardLabel: dashboard?.payPeriodLabel,
    payDate,
    payFrequency,
  }), [activeAnchor, dashboard?.payPeriodLabel, payDate, payFrequency]);
  const previousPayPeriodLabel = useMemo(() => getPayPeriodLabel({
    anchor: previousAnchor,
    dashboardLabel: dashboard?.previousPayPeriodLabel,
    payDate,
    payFrequency,
  }), [dashboard?.previousPayPeriodLabel, payDate, payFrequency, previousAnchor]);
  const currentIncomeTotal = useMemo(() => {
    const month = currentYearIncome?.months?.find((entry) => entry.monthIndex === activeAnchor.month);
    return month?.total ?? 0;
  }, [activeAnchor.month, currentYearIncome?.months]);
  const previousIncomeTotal = useMemo(() => {
    const month = (previousYearIncome?.months ?? []).find((entry) => entry.monthIndex === previousAnchor.month);
    return month?.total ?? 0;
  }, [previousAnchor.month, previousYearIncome?.months]);
  const currentExpenseTotal = currentExpenseQuery.data?.totalAmount ?? dashboard?.totalExpenses ?? expensesByMonth[currentMonthIndex] ?? 0;
  const previousExpenseTotal = previousExpenseQuery.data?.totalAmount ?? dashboard?.expenseInsights?.recap?.totalAmount ?? 0;
  const currentDebtDue = useMemo(() => (
    (debt?.debts ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.dueThisMonth ?? item.computedMonthlyPayment ?? 0)), 0)
  ), [debt?.debts]);
  const annualDebtService = useMemo(() => Math.max(0, (debt?.totalMonthlyDebtPayments ?? 0) * 12), [debt?.totalMonthlyDebtPayments]);

  const insightRows = useMemo(() => buildAnalyticsInsightRows({
    annualDebtService,
    annualExpenseTotal,
    annualIncomeTotal,
    currency,
    currentDebtDue,
    currentExpenseTotal,
    currentIncomeTotal,
    currentPayPeriodLabel,
    dashboard: dashboard ?? null,
    debt,
    expensesByMonth,
    income,
    overviewMode,
  }), [annualDebtService, annualExpenseTotal, annualIncomeTotal, currency, currentDebtDue, currentExpenseTotal, currentIncomeTotal, currentPayPeriodLabel, dashboard, debt, expensesByMonth, income, overviewMode]);

  const topTips = useMemo(() => buildAnalyticsTopTips({
    annualDebtService,
    annualExpenseTotal,
    annualIncomeTotal,
    currency,
    currentDebtDue,
    currentExpenseTotal,
    currentIncomeTotal,
    currentPayPeriodLabel,
    dashboard: dashboard ?? null,
    debt,
    expensesByMonth,
    income,
    overviewMode,
  }), [annualDebtService, annualExpenseTotal, annualIncomeTotal, currency, currentDebtDue, currentExpenseTotal, currentIncomeTotal, currentPayPeriodLabel, dashboard, debt, expensesByMonth, income, overviewMode]);

  const chartData = useMemo(() => buildAnalyticsChartData({
    currentExpenseTotal,
    currentIncomeTotal,
    currentPayPeriodLabel,
    expensesByMonth,
    income,
    overviewMode,
    previousExpenseTotal,
    previousIncomeTotal,
    previousPayPeriodLabel,
  }), [currentExpenseTotal, currentIncomeTotal, currentPayPeriodLabel, expensesByMonth, income, overviewMode, previousExpenseTotal, previousIncomeTotal, previousPayPeriodLabel]);

  const overviewMaxValue = useMemo(() => {
    const unit = 500;
    return Math.max(unit, Math.ceil((chartData.maxValue || 0) / unit) * unit);
  }, [chartData.maxValue]);

  const overviewIncomeLine = useMemo<AnalyticsOverviewLinePoint[]>(
    () => chartData.incomeSeries.map((value, idx) => ({
      value,
      label: chartData.labels[idx] ?? "",
      rawLabel: chartData.rawLabels[idx] ?? chartData.labels[idx] ?? "",
    })),
    [chartData.incomeSeries, chartData.labels, chartData.rawLabels],
  );
  const overviewExpenseLine = useMemo<AnalyticsOverviewLinePoint[]>(
    () => chartData.expenseSeries.map((value, idx) => ({
      value,
      label: chartData.labels[idx] ?? "",
      rawLabel: chartData.rawLabels[idx] ?? chartData.labels[idx] ?? "",
    })),
    [chartData.expenseSeries, chartData.labels, chartData.rawLabels],
  );
  const fallbackOverviewWidth = useMemo(() => Math.max(240, windowWidth - 76), [windowWidth]);
  const chartWidth = useMemo(() => {
    const base = overviewWrapWidth > 0 ? overviewWrapWidth : fallbackOverviewWidth;
    return Math.max(220, base - 8);
  }, [fallbackOverviewWidth, overviewWrapWidth]);
  const chartSpacing = useMemo(() => {
    if (overviewMode !== "year") return Math.max(120, Math.round((chartWidth - 28) / 2));
    const points = Math.max(2, chartData.labels.length);
    const usable = Math.max(180, chartWidth - 20);
    return Math.max(14, Math.round(usable / (points - 1)));
  }, [chartData.labels.length, chartWidth, overviewMode]);
  const debtDistribution = useMemo(() => buildDebtDistribution({ debt, overviewMode }), [debt, overviewMode]);
  const debtDistributionTitle = overviewMode === "year" ? "Debt Distribution" : "Debt Due Distribution";
  const loading = bootstrapLoading || Boolean(
    (debtQuery.isLoading || currentYearIncomeQuery.isLoading || expenseSeriesQuery.isLoading || currentExpenseQuery.isLoading || previousExpenseQuery.isLoading)
      && !debt
      && !income,
  );

  return {
    chartData,
    chartSpacing,
    chartWidth,
    currency,
    currentMonthLabel,
    debtDistribution,
    debtDistributionTitle,
    error,
    insightRows,
    loading,
    onRefresh: () => {
      setRefreshing(true);
      void refreshAll();
    },
    overviewExpenseLine,
    overviewIncomeLine,
    overviewMaxValue,
    overviewMode,
    overviewWrapWidth,
    refreshing,
    retry: () => {
      setRefreshing(true);
      void refreshAll();
    },
    setOverviewWrapWidth,
    topHeaderOffset,
    topTips,
  };
}