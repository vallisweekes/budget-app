import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { currencySymbol } from "@/lib/formatting";
import { asMoneyNumber } from "@/lib/helpers/settings";
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
import { useAppLocale, useAppTranslation, useTopHeaderOffset } from "@/hooks";
import type { DebtSummaryData } from "@/lib/apiTypes";
import { normalizePayFrequency } from "@/lib/payPeriods";
import type { AnalyticsOverviewLinePoint, AnalyticsOverviewMode, AnalyticsScreenControllerState } from "@/types/AnalyticsScreen.types";
import { useGetAnalyticsExpenseSeriesQuery, useGetDebtSummaryQuery, useGetExpenseSummaryQuery, useGetIncomeSummaryQuery } from "@/store/api";

function buildDashboardDebtSummary(dashboard: NonNullable<ReturnType<typeof useBootstrapData>["dashboard"]>): DebtSummaryData {
  const debts = dashboard.debts.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    logoUrl: item.logoUrl ?? null,
    currentBalance: item.currentBalance,
    initialBalance: item.initialBalance,
    paidAmount: item.paidAmount,
    monthlyMinimum: item.monthlyMinimum,
    interestRate: item.interestRate,
    installmentMonths: item.installmentMonths,
    amount: item.amount,
    paid: item.currentBalance <= 0,
    creditLimit: item.creditLimit,
    dueDay: item.dueDay ?? null,
    sourceType: item.sourceType ?? null,
    sourceExpenseName: null,
    computedMonthlyPayment: item.monthlyMinimum ?? item.amount,
    dueThisMonth: item.monthlyMinimum ?? item.amount,
    paidThisMonth: item.paidThisMonthAmount,
    isPaymentMonthPaid: item.currentBalance <= 0,
    isActive: item.currentBalance > 0,
  }));
  const activeCount = debts.filter((item) => item.isActive).length;
  const creditCardCount = debts.filter((item) => item.type === "credit_card").length;

  return {
    debts,
    liabilities: [],
    liabilityCount: 0,
    totalLiabilityBalance: 0,
    activeCount,
    paidCount: Math.max(0, debts.length - activeCount),
    totalDebtBalance: dashboard.totalDebtBalance,
    totalMonthlyDebtPayments: Math.max(0, dashboard.plannedDebtPayments ?? 0),
    creditCardCount,
    regularDebtCount: Math.max(0, debts.length - creditCardCount),
    expenseDebtCount: 0,
    tips: [],
  };
}

function getDebtSummaryStrength(summary: DebtSummaryData | null | undefined): {
  balance: number;
  activeCount: number;
  debtCount: number;
} {
  if (!summary) {
    return { balance: 0, activeCount: 0, debtCount: 0 };
  }

  const rowBalance = (summary.debts ?? []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.currentBalance ?? 0)),
    0,
  );
  const rowActiveCount = (summary.debts ?? []).reduce(
    (count, item) => count + (Number(item.currentBalance ?? 0) > 0 ? 1 : 0),
    0,
  );

  return {
    balance: Math.max(0, Number(summary.totalDebtBalance ?? 0), rowBalance),
    activeCount: Math.max(0, Number(summary.activeCount ?? 0), rowActiveCount),
    debtCount: summary.debts?.length ?? 0,
  };
}

export function useAnalyticsScreenController(
  options?: { overviewMode?: AnalyticsOverviewMode }
): AnalyticsScreenControllerState {
  const { locale } = useAppLocale();
  const { t } = useAppTranslation();
  const isFocused = useIsFocused();
  const topHeaderOffset = useTopHeaderOffset();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ overviewMode?: string }>();
  const { dashboard, settings, lastLoadedAt } = useBootstrapData();
  const [refreshing, setRefreshing] = useState(false);
  const [overviewWrapWidth, setOverviewWrapWidth] = useState(0);
  const lastBootstrapRefreshSeenRef = useRef<number | null>(null);
  const overviewMode: AnalyticsOverviewMode = options?.overviewMode ?? (params.overviewMode === "month" ? "month" : "year");

  const currency = currencySymbol(settings?.currency);
  const activeAnchor = useMemo(() => getActiveAnalyticsAnchor(dashboard?.monthNum, dashboard?.year), [dashboard?.monthNum, dashboard?.year]);
  const previousAnchor = useMemo(() => getPreviousAnalyticsAnchor(activeAnchor), [activeAnchor]);
  const payDate = Number.isFinite(dashboard?.payDate) ? Number(dashboard?.payDate) : (settings?.payDate ?? 1);
  const payFrequency = normalizePayFrequency(dashboard?.payFrequency ?? settings?.payFrequency);
  const shouldLoadPayPeriodComparisonData = overviewMode === "month";

  const currentYearIncomeQuery = useGetIncomeSummaryQuery(activeAnchor.year);
  const previousYearIncomeQuery = useGetIncomeSummaryQuery(previousAnchor.year, {
    skip: previousAnchor.year === activeAnchor.year,
  });
  const debtQuery = useGetDebtSummaryQuery();
  const expenseSeriesQuery = useGetAnalyticsExpenseSeriesQuery({
    year: activeAnchor.year,
    budgetPlanId: dashboard?.budgetPlanId ?? null,
  });
  const currentExpenseQuery = useGetExpenseSummaryQuery({
    month: activeAnchor.month,
    year: activeAnchor.year,
    budgetPlanId: dashboard?.budgetPlanId ?? null,
    scope: "pay_period",
  });
  const previousExpenseQuery = useGetExpenseSummaryQuery({
    month: previousAnchor.month,
    year: previousAnchor.year,
    budgetPlanId: dashboard?.budgetPlanId ?? null,
    scope: "pay_period",
  });

  const income = currentYearIncomeQuery.data ?? null;
  const dashboardDebtSummary = useMemo<DebtSummaryData | null>(() => {
    if (!dashboard) return null;
    return buildDashboardDebtSummary(dashboard);
  }, [dashboard]);
  const debt = useMemo<DebtSummaryData | null>(() => {
    const apiDebt = debtQuery.data ?? null;
    const dashboardDebt = dashboardDebtSummary;

    if (apiDebt && dashboardDebt) {
      const apiStrength = getDebtSummaryStrength(apiDebt);
      const dashboardStrength = getDebtSummaryStrength(dashboardDebt);

      const preferApi =
        apiStrength.balance >= dashboardStrength.balance
        || apiStrength.activeCount >= dashboardStrength.activeCount
        || apiStrength.debtCount >= dashboardStrength.debtCount;

      return preferApi ? apiDebt : dashboardDebt;
    }

    return apiDebt ?? dashboardDebt ?? null;
  }, [dashboardDebtSummary, debtQuery.data]);
  const expensesByMonth = expenseSeriesQuery.data ?? Array(12).fill(0);
  const currentYearIncome = currentYearIncomeQuery.data ?? null;
  const previousYearIncome = previousAnchor.year === activeAnchor.year
    ? currentYearIncomeQuery.data ?? null
    : previousYearIncomeQuery.data ?? null;
  const hasAnalyticsData = overviewMode === "year"
    ? Boolean(currentYearIncome && debt && expenseSeriesQuery.data)
    : Boolean(currentYearIncome && debt && currentExpenseQuery.data && previousExpenseQuery.data);

  const refreshAnalyticsQueries = useCallback(async () => {
    await Promise.all([
      debtQuery.refetch(),
      currentYearIncomeQuery.refetch(),
      shouldLoadPayPeriodComparisonData && previousAnchor.year !== activeAnchor.year
        ? previousYearIncomeQuery.refetch()
        : Promise.resolve(),
      expenseSeriesQuery.refetch(),
      shouldLoadPayPeriodComparisonData ? currentExpenseQuery.refetch() : Promise.resolve(),
      shouldLoadPayPeriodComparisonData ? previousExpenseQuery.refetch() : Promise.resolve(),
    ]);
  }, [activeAnchor.year, currentExpenseQuery, currentYearIncomeQuery, debtQuery, expenseSeriesQuery, previousAnchor.year, previousExpenseQuery, previousYearIncomeQuery, shouldLoadPayPeriodComparisonData]);

  useEffect(() => {
    if (!isFocused || !lastLoadedAt) {
      return;
    }

    const previousLoadedAt = lastBootstrapRefreshSeenRef.current;
    lastBootstrapRefreshSeenRef.current = lastLoadedAt;

    if (!previousLoadedAt || previousLoadedAt === lastLoadedAt) {
      return;
    }

    if (!hasAnalyticsData) {
      return;
    }

    void refreshAnalyticsQueries();
  }, [hasAnalyticsData, isFocused, lastLoadedAt, refreshAnalyticsQueries]);

  const refreshAll = useCallback(async () => {
    try {
      await refreshAnalyticsQueries();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAnalyticsQueries]);

  const error = useMemo(() => {
    const payPeriodComparisonError = shouldLoadPayPeriodComparisonData
      ? (previousYearIncomeQuery.error
        ?? currentExpenseQuery.error
        ?? previousExpenseQuery.error)
      : null;

    const nextError = debtQuery.error
      ?? currentYearIncomeQuery.error
      ?? expenseSeriesQuery.error
      ?? payPeriodComparisonError;
    if (!nextError) return null;
    return nextError instanceof Error ? nextError.message : t("analytics.loadFailed");
  }, [currentExpenseQuery.error, currentYearIncomeQuery.error, debtQuery.error, expenseSeriesQuery.error, previousExpenseQuery.error, previousYearIncomeQuery.error, shouldLoadPayPeriodComparisonData, t]);

  const annualIncomeTotal = useMemo(() => (
    income?.grandTotal ?? (income?.months ?? []).reduce((sum, month) => sum + (month.total ?? 0), 0)
  ), [income?.grandTotal, income?.months]);
  const annualExpenseTotal = useMemo(() => expensesByMonth.reduce((sum, value) => sum + value, 0), [expensesByMonth]);
  const currentMonthIndex = activeAnchor.month - 1;
  const currentMonthLabel = useMemo(() => getAnalyticsMonthLabel(new Date(activeAnchor.year, activeAnchor.month - 1, 1), locale), [activeAnchor.month, activeAnchor.year, locale]);
  const currentPayPeriodLabel = useMemo(() => getPayPeriodLabel({
    anchor: activeAnchor,
    dashboardLabel: dashboard?.payPeriodLabel,
    payDate,
    payFrequency,
    locale,
  }), [activeAnchor, dashboard?.payPeriodLabel, locale, payDate, payFrequency]);
  const previousPayPeriodLabel = useMemo(() => getPayPeriodLabel({
    anchor: previousAnchor,
    dashboardLabel: dashboard?.previousPayPeriodLabel,
    payDate,
    payFrequency,
    locale,
  }), [dashboard?.previousPayPeriodLabel, locale, payDate, payFrequency, previousAnchor]);
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
    analyticsYear: activeAnchor.year,
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
    payDate,
    payFrequency,
  }, { t }), [annualDebtService, annualExpenseTotal, annualIncomeTotal, currency, currentDebtDue, currentExpenseTotal, currentIncomeTotal, currentPayPeriodLabel, dashboard, debt, expensesByMonth, income, overviewMode, payDate, payFrequency, t]);

  const topTips = useMemo(() => buildAnalyticsTopTips({
    annualDebtService,
    annualExpenseTotal,
    annualIncomeTotal,
    analyticsYear: activeAnchor.year,
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
    payDate,
    payFrequency,
  }, { locale, t }), [activeAnchor.year, annualDebtService, annualExpenseTotal, annualIncomeTotal, currency, currentDebtDue, currentExpenseTotal, currentIncomeTotal, currentPayPeriodLabel, dashboard, debt, expensesByMonth, income, locale, overviewMode, payDate, payFrequency, t]);

  const chartData = useMemo(() => buildAnalyticsChartData({
    currentExpenseTotal,
    currentIncomeTotal,
    currentPayPeriodLabel,
    expensesByMonth,
    income,
    locale,
    overviewMode,
    previousExpenseTotal,
    previousIncomeTotal,
    previousPayPeriodLabel,
  }), [currentExpenseTotal, currentIncomeTotal, currentPayPeriodLabel, expensesByMonth, income, locale, overviewMode, previousExpenseTotal, previousIncomeTotal, previousPayPeriodLabel]);

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
  const fallbackOverviewWidth = useMemo(() => Math.max(260, windowWidth - 48), [windowWidth]);
  const chartWidth = useMemo(() => {
    const base = overviewWrapWidth > 0 ? overviewWrapWidth : fallbackOverviewWidth;
    return Math.max(240, base);
  }, [fallbackOverviewWidth, overviewWrapWidth]);
  const chartSpacing = useMemo(() => {
    if (overviewMode !== "year") return Math.max(120, Math.round((chartWidth - 28) / 2));
    const points = Math.max(2, chartData.labels.length);
    const usable = Math.max(180, chartWidth - 20);
    return Math.max(14, Math.round(usable / (points - 1)));
  }, [chartData.labels.length, chartWidth, overviewMode]);
  const debtDistribution = useMemo(() => buildDebtDistribution({ debt, overviewMode }), [debt, overviewMode]);
  const debtDistributionTitle = overviewMode === "year" ? t("analytics.debt.distributionTitle") : t("analytics.debt.dueDistributionTitle");
  const totalAssets = Math.max(0, asMoneyNumber(settings?.savingsBalance))
    + Math.max(0, asMoneyNumber(settings?.emergencyBalance))
    + Math.max(0, asMoneyNumber(settings?.investmentBalance));
  const liabilitiesFromDebtSummary = Math.max(0, Number(debtQuery.data?.totalDebtBalance ?? 0));
  const liabilitiesFromDebtRows = (debtQuery.data?.debts ?? []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.currentBalance ?? 0)),
    0,
  );
  const liabilitiesFromDashboardSummary = Math.max(0, Number(dashboard?.totalDebtBalance ?? 0));
  const liabilitiesFromDashboardRows = (dashboard?.debts ?? []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.currentBalance ?? 0)),
    0,
  );
  const totalLiabilities = Math.max(
    liabilitiesFromDebtSummary,
    liabilitiesFromDebtRows,
    liabilitiesFromDashboardSummary,
    liabilitiesFromDashboardRows,
  );
  const netWorth = totalAssets - totalLiabilities;
  const stableMonthlyDebtService = useMemo(
    () => Math.max(
      0,
      Number(debtQuery.data?.totalMonthlyDebtPayments ?? 0),
      Number(dashboardDebtSummary?.totalMonthlyDebtPayments ?? 0),
      Number(dashboard?.plannedDebtPayments ?? 0),
    ),
    [dashboard?.plannedDebtPayments, dashboardDebtSummary?.totalMonthlyDebtPayments, debtQuery.data?.totalMonthlyDebtPayments],
  );
  const netWorthTrendLabels = useMemo(() => {
    const lastMonthIndex = Math.max(0, Math.min(11, activeAnchor.month - 1));
    return Array.from(
      { length: lastMonthIndex + 1 },
      (_, index) => getAnalyticsMonthLabel(new Date(activeAnchor.year, index, 1), locale),
    );
  }, [activeAnchor.month, activeAnchor.year, locale]);
  const netWorthTrendValues = useMemo(() => {
    const lastMonthIndex = Math.max(0, Math.min(11, activeAnchor.month - 1));
    const incomeByMonth = Array(12).fill(0);
    (currentYearIncome?.months ?? []).forEach((month) => {
      if (month.monthIndex >= 1 && month.monthIndex <= 12) {
        incomeByMonth[month.monthIndex - 1] = month.total ?? 0;
      }
    });

    const netFlows = Array.from({ length: lastMonthIndex + 1 }, (_, index) => (
      Number(incomeByMonth[index] ?? 0)
      - Number(expensesByMonth[index] ?? 0)
      - stableMonthlyDebtService
    ));

    let rolling = 0;
    const cumulative = netFlows.map((flow) => {
      rolling += flow;
      return rolling;
    });

    const currentAnchor = cumulative[cumulative.length - 1] ?? 0;
    return cumulative.map((value) => netWorth - (currentAnchor - value));
  }, [activeAnchor.month, currentYearIncome?.months, expensesByMonth, netWorth, stableMonthlyDebtService]);
  const loading = Boolean(
    (debtQuery.isLoading && !debt)
    || (currentYearIncomeQuery.isLoading && !income)
    || (expenseSeriesQuery.isLoading && !expenseSeriesQuery.data)
    || (shouldLoadPayPeriodComparisonData && currentExpenseQuery.isLoading && !currentExpenseQuery.data)
    || (shouldLoadPayPeriodComparisonData && previousExpenseQuery.isLoading && !previousExpenseQuery.data)
  );

  return {
    chartData,
    chartSpacing,
    chartWidth,
    currency,
    currentMonthLabel,
    netWorth,
    totalAssets,
    totalLiabilities,
    netWorthTrendValues,
    netWorthTrendLabels,
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