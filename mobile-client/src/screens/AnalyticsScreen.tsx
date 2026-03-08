import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect } from "react-native-svg";
import { LineChart } from "react-native-gifted-charts";
import { useRoute } from "@react-navigation/native";

import type { DebtSummaryData } from "@/lib/apiTypes";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { currencySymbol, fmt } from "@/lib/formatting";
import type { RootStackScreenProps } from "@/navigation/types";
import { buildPayPeriodFromMonthAnchor, formatPayPeriodLabel, normalizePayFrequency } from "@/lib/payPeriods";
import { useGetAnalyticsExpenseSeriesQuery, useGetDebtSummaryQuery, useGetExpenseSummaryQuery, useGetIncomeSummaryQuery } from "@/store/api";

import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";

const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const OVERVIEW_CHART_H = 180;
const ANALYTICS_MONTH_LABEL = (date: Date) => MONTH_SHORT[date.getMonth()] ?? "THIS MONTH";

export default function AnalyticsScreen({ navigation }: RootStackScreenProps<"Analytics">) {
  const topHeaderOffset = useTopHeaderOffset();
  const { width: windowWidth } = useWindowDimensions();
  const route = useRoute<RootStackScreenProps<"Analytics">["route"]>();

  const {
    dashboard,
    settings,
    isLoading: bootstrapLoading,
    refresh: refreshBootstrap,
  } = useBootstrapData();
  const [refreshing, setRefreshing] = useState(false);
  const [overviewWrapWidth, setOverviewWrapWidth] = useState(0);
  const overviewMode = route.params?.overviewMode === "month" ? "month" : "year";

  useEffect(() => {
    if (route.params?.overviewMode === "month" || route.params?.overviewMode === "year") return;
    navigation.setParams({ overviewMode: "year" });
  }, [navigation, route.params?.overviewMode]);

  const currency = currencySymbol(settings?.currency);
  const activeAnchor = useMemo(() => ({
    month: Number.isFinite(dashboard?.monthNum) ? Number(dashboard?.monthNum) : new Date().getMonth() + 1,
    year: Number.isFinite(dashboard?.year) ? Number(dashboard?.year) : new Date().getFullYear(),
  }), [dashboard?.monthNum, dashboard?.year]);
  const previousAnchor = useMemo(() => (
    activeAnchor.month === 1
      ? { month: 12, year: activeAnchor.year - 1 }
      : { month: activeAnchor.month - 1, year: activeAnchor.year }
  ), [activeAnchor.month, activeAnchor.year]);
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

  const now = useMemo(() => new Date(), []);
  const currentMonthIndex = activeAnchor.month - 1;
  const currentMonthLabel = ANALYTICS_MONTH_LABEL(new Date(activeAnchor.year, activeAnchor.month - 1, 1));
  const currentPayPeriodLabel = useMemo(() => {
    if (dashboard?.payPeriodLabel?.trim()) return dashboard.payPeriodLabel.trim();
    const period = buildPayPeriodFromMonthAnchor({
      year: activeAnchor.year,
      month: activeAnchor.month,
      payDate,
      payFrequency,
    });
    return formatPayPeriodLabel(period.start, period.end);
  }, [activeAnchor.month, activeAnchor.year, dashboard?.payPeriodLabel, payDate, payFrequency]);
  const previousPayPeriodLabel = useMemo(() => {
    if (dashboard?.previousPayPeriodLabel?.trim()) return dashboard.previousPayPeriodLabel.trim();
    const period = buildPayPeriodFromMonthAnchor({
      year: previousAnchor.year,
      month: previousAnchor.month,
      payDate,
      payFrequency,
    });
    return formatPayPeriodLabel(period.start, period.end);
  }, [dashboard?.previousPayPeriodLabel, payDate, payFrequency, previousAnchor.month, previousAnchor.year]);
  const currentIncomeTotal = useMemo(() => {
    const month = currentYearIncome?.months?.find((entry) => entry.monthIndex === activeAnchor.month);
    return month?.total ?? 0;
  }, [activeAnchor.month, currentYearIncome?.months]);
  const previousIncomeTotal = useMemo(() => {
    const source = previousYearIncome?.months ?? [];
    const month = source.find((entry) => entry.monthIndex === previousAnchor.month);
    return month?.total ?? 0;
  }, [previousAnchor.month, previousYearIncome?.months]);
  const currentExpenseTotal = currentExpenseQuery.data?.totalAmount ?? dashboard?.totalExpenses ?? expensesByMonth[currentMonthIndex] ?? 0;
  const previousExpenseTotal = previousExpenseQuery.data?.totalAmount ?? dashboard?.expenseInsights?.recap?.totalAmount ?? 0;
  const currentDebtDue = useMemo(() => (
    (debt?.debts ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.dueThisMonth ?? item.computedMonthlyPayment ?? 0)), 0)
  ), [debt?.debts]);
  const annualDebtService = useMemo(() => Math.max(0, (debt?.totalMonthlyDebtPayments ?? 0) * 12), [debt?.totalMonthlyDebtPayments]);

  const insightRows = useMemo(() => {
    const monthlyDebt = debt?.totalMonthlyDebtPayments ?? 0;
    const upcomingCount = dashboard?.expenseInsights?.upcoming?.length ?? 0;
    const monthsWithIncome = income?.monthsWithIncome ?? 0;
    const monthsWithSpend = expensesByMonth.filter((value) => value > 0).length;
    const activeDebts = debt?.activeCount ?? 0;

    if (overviewMode === "month") {
      const debtLoadPct = currentIncomeTotal > 0 ? Math.min(100, Math.round((monthlyDebt / currentIncomeTotal) * 100)) : 0;
      return [
        { label: "Income", value: fmt(currentIncomeTotal, currency), sub: `${currentPayPeriodLabel}` },
        { label: "Expenses", value: fmt(currentExpenseTotal, currency), sub: `${currentPayPeriodLabel}` },
        { label: "Debt Due", value: fmt(currentDebtDue, currency), sub: `${activeDebts} active debts` },
        { label: "Debt Load", value: `${debtLoadPct}%`, sub: `${fmt(monthlyDebt, currency)} / month` },
      ];
    }

    const debtLoadPct = annualIncomeTotal > 0 ? Math.min(100, Math.round((annualDebtService / annualIncomeTotal) * 100)) : 0;

    return [
      { label: "Income", value: fmt(annualIncomeTotal, currency), sub: `${monthsWithIncome}/12 months funded` },
      { label: "Expenses", value: fmt(annualExpenseTotal, currency), sub: `${monthsWithSpend}/12 months with spend` },
      { label: "Debt", value: fmt(debt?.totalDebtBalance ?? 0, currency), sub: `${activeDebts} active debts` },
      { label: "Debt Load", value: `${debtLoadPct}%`, sub: `${fmt(annualDebtService, currency)} / year` },
    ];
  }, [annualDebtService, annualExpenseTotal, annualIncomeTotal, currency, currentDebtDue, currentExpenseTotal, currentIncomeTotal, currentPayPeriodLabel, dashboard, debt, expensesByMonth, income, overviewMode]);

  const topTips = useMemo(() => {
    if (overviewMode === "year") {
      const highestExpense = expensesByMonth.reduce<{ monthIndex: number; total: number }>((best, total, monthIndex) => (
        total > best.total ? { monthIndex, total } : best
      ), { monthIndex: 0, total: 0 });
      const highestIncome = (income?.months ?? []).reduce<{ monthIndex: number; total: number }>((best, month) => (
        month.total > best.total ? { monthIndex: month.monthIndex - 1, total: month.total } : best
      ), { monthIndex: 0, total: 0 });
      const monthsWithSpend = expensesByMonth.filter((value) => value > 0).length;
      const monthsWithIncome = income?.monthsWithIncome ?? 0;
      const debtLoadPct = annualIncomeTotal > 0 ? Math.min(100, Math.round((annualDebtService / annualIncomeTotal) * 100)) : 0;

      return [
        {
          title: "Highest income month",
          detail: `${MONTH_SHORT[highestIncome.monthIndex] ?? "N/A"} brought in ${fmt(highestIncome.total, currency)}.`,
          priority: 65,
        },
        {
          title: "Highest expense month",
          detail: `${MONTH_SHORT[highestExpense.monthIndex] ?? "N/A"} used ${fmt(highestExpense.total, currency)}.`,
          priority: highestExpense.total > annualIncomeTotal / 6 ? 82 : 58,
        },
        {
          title: "Yearly debt load",
          detail: `${debtLoadPct}% of annual income is going to planned debt payments (${fmt(annualDebtService, currency)}).`,
          priority: debtLoadPct >= 20 ? 84 : 60,
        },
        {
          title: "Coverage this year",
          detail: `${monthsWithIncome}/12 months have income and ${monthsWithSpend}/12 months have recorded spend.`,
          priority: 55,
        },
      ];
    }

    const expenseTips = (dashboard?.expenseInsights?.recapTips ?? []).slice(0, 3);
    const debtTips = (debt?.tips ?? []).slice(0, 2);
    return [...expenseTips, ...debtTips].slice(0, 4);
  }, [annualDebtService, annualIncomeTotal, currency, dashboard?.expenseInsights?.recapTips, debt?.tips, expensesByMonth, income?.months, income?.monthsWithIncome, overviewMode]);

  const chartData = useMemo(() => {
    const incomeYear = Array(12).fill(0);
    (income?.months ?? []).forEach((m) => {
      if (m.monthIndex >= 1 && m.monthIndex <= 12) {
        incomeYear[m.monthIndex - 1] = m.total ?? 0;
      }
    });

    if (overviewMode === "year") {
      const maxValue = Math.max(...incomeYear, ...expensesByMonth, 1);
      return {
        labels: MONTH_SHORT,
        rawLabels: MONTH_SHORT,
        incomeSeries: incomeYear,
        expenseSeries: expensesByMonth,
        maxValue,
      };
    }

    const incomeSeries = [previousIncomeTotal, currentIncomeTotal];
    const expenseSeries = [previousExpenseTotal, currentExpenseTotal];
    const maxValue = Math.max(...incomeSeries, ...expenseSeries, 1);

    return {
      labels: ["Previous", "Current"],
      rawLabels: [previousPayPeriodLabel, currentPayPeriodLabel],
      incomeSeries,
      expenseSeries,
      maxValue,
    };
  }, [currentExpenseTotal, currentIncomeTotal, currentPayPeriodLabel, expensesByMonth, income?.months, overviewMode, previousExpenseTotal, previousIncomeTotal, previousPayPeriodLabel]);

  const overviewMaxValue = useMemo(() => {
    const unit = 500;
    return Math.max(unit, Math.ceil((chartData.maxValue || 0) / unit) * unit);
  }, [chartData.maxValue]);

  const overviewIncomeLine = useMemo(
    () => chartData.incomeSeries.map((value, idx) => ({ value, label: chartData.labels[idx] ?? "" })),
    [chartData.incomeSeries, chartData.labels]
  );

  const overviewExpenseLine = useMemo(
    () => chartData.expenseSeries.map((value) => ({ value })),
    [chartData.expenseSeries]
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

  const debtDistribution = useMemo(() => {
    const getValue = (item: DebtSummaryData["debts"][number]) => (
      overviewMode === "year"
        ? item.currentBalance
        : Math.max(0, Number(item.dueThisMonth ?? item.computedMonthlyPayment ?? 0))
    );
    const topDebts = [...(debt?.debts ?? [])]
      .filter((item) => overviewMode === "year"
        ? item.currentBalance > 0
        : Math.max(0, Number(item.dueThisMonth ?? item.computedMonthlyPayment ?? 0)) > 0)
      .sort((a, b) => getValue(b) - getValue(a))
      .slice(0, 5);
    const max = Math.max(...topDebts.map((item) => getValue(item)), 1);
    return topDebts.map((item) => ({
      id: item.id,
      name: item.name,
      value: getValue(item),
      ratio: getValue(item) / max,
    }));
  }, [debt?.debts, overviewMode]);

  const debtDistributionTitle = overviewMode === "year" ? "Debt Distribution" : "Debt Due Distribution";

  const loading = bootstrapLoading || Boolean(
    (debtQuery.isLoading || currentYearIncomeQuery.isLoading || expenseSeriesQuery.isLoading || currentExpenseQuery.isLoading || previousExpenseQuery.isLoading)
      && !debt
      && !income
  );

  if (loading) {
    return (
			<SafeAreaView style={s.safe} edges={[]}>
        <View style={[s.center, { paddingTop: topHeaderOffset }]}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.loading}>Loading analytics…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={s.safe} edges={[]}>
        <View style={[s.center, { paddingTop: topHeaderOffset }]}>
          <Ionicons name="cloud-offline-outline" size={42} color={T.textDim} />
          <Text style={s.error}>{error}</Text>
          <Pressable onPress={() => { setRefreshing(true); void refreshAll(); }} style={s.retryBtn}>
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
		<SafeAreaView style={s.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: topHeaderOffset }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void refreshAll(); }} tintColor={T.accent} />}
      >
        <View style={s.grid}>
          {insightRows.map((row) => (
            <View key={row.label} style={s.card}>
              <Text style={s.cardLabel}>{row.label}</Text>
              <Text style={s.cardValue}>{row.value}</Text>
              <Text style={s.cardSub}>{row.sub}</Text>
            </View>
          ))}
        </View>

        <View style={s.tipCard}>
          <View style={s.overviewHead}>
            <Text style={s.tipTitle}>Overview</Text>
            <Text style={s.overviewModeBadge}>{overviewMode === "year" ? "Yearly view" : `${currentMonthLabel} snapshot`}</Text>
          </View>

          <View
            style={s.overviewChartWrap}
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              if (width > 0 && Math.abs(width - overviewWrapWidth) > 1) {
                setOverviewWrapWidth(width);
              }
            }}
          >
            <LineChart
              data={overviewIncomeLine}
              data2={overviewExpenseLine}
              curved
              color1="#2c91ff"
              color2="#ef4fa6"
              thickness={2}
              thickness2={2}
              height={OVERVIEW_CHART_H}
              width={chartWidth}
              initialSpacing={0}
              endSpacing={0}
              spacing={chartSpacing}
              noOfSections={5}
              maxValue={overviewMaxValue}
              yAxisColor={T.border}
              xAxisColor={T.border}
              yAxisTextStyle={s.chartAxisText}
              xAxisLabelTextStyle={s.chartAxisXText}
              rulesColor={T.border}
              rulesType="dashed"
              hideDataPoints={false}
              dataPointsColor="#2c91ff"
              dataPointsColor2="#ef4fa6"
              dataPointsRadius={3}
              dataPointsRadius2={3}
              areaChart
              startFillColor="#2c91ff"
              endFillColor="#2c91ff"
              startOpacity={0.16}
              endOpacity={0.02}
              pointerConfig={{
                activatePointersOnLongPress: true,
                autoAdjustPointerLabelPosition: true,
                pointerStripColor: "#2c91ff",
                pointerStripWidth: 1,
                strokeDashArray: [4, 4],
                pointerColor: "#2c91ff",
                radius: 4,
                pointerLabelWidth: 128,
                pointerLabelHeight: 64,
                pointerLabelComponent: (items: Array<{ value: number; index: number }>) => {
                  const item = items?.[0];
                  if (!item) return null;
                  const index = Number.isFinite(item.index) ? item.index : 0;
                  const monthLabel = chartData.rawLabels[index] ?? chartData.labels[index] ?? "";
                  return (
                    <View style={s.pointerTooltip}>
                      <Text style={s.pointerTooltipValue}>{fmt(item.value ?? 0, currency)}</Text>
                      <Text style={s.pointerTooltipMonth}>{monthLabel}</Text>
                    </View>
                  );
                },
              }}
            />
          </View>

          <View style={s.legendRow}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: "#2c91ff" }]} />
              <Text style={s.legendText}>Income</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: "#ef4fa6" }]} />
              <Text style={s.legendText}>Expenses</Text>
            </View>
          </View>
        </View>

        <View style={s.tipCard}>
          <Text style={s.tipTitle}>Top Insights</Text>
          {topTips.length === 0 ? (
            <Text style={s.tipText}>No insights yet.</Text>
          ) : (
            topTips.map((tip, idx) => (
              <View key={`${tip.title}-${idx}`} style={[s.tipRow, idx > 0 && s.tipRowBorder]}>
                <Ionicons name="sparkles-outline" size={14} color={T.accent} />
                <View style={{ flex: 1 }}>
                  <View style={s.tipTitleRow}>
                    <Text style={s.tipRowTitle}>{tip.title}</Text>
                    {Number(tip?.priority ?? 0) >= 80 ? <Text style={s.priorityBadge}>High priority</Text> : null}
                  </View>
                  <Text style={s.tipText}>{tip.detail}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={s.tipCard}>
          <Text style={s.tipTitle}>{debtDistributionTitle}</Text>
          {debtDistribution.length === 0 ? (
            <Text style={s.tipText}>{overviewMode === "year" ? "No active debt balances." : "No debt payments due this month."}</Text>
          ) : (
            debtDistribution.map((item) => (
              <View key={item.id} style={s.barRow}>
                <View style={s.barRowHead}>
                  <Text style={s.barName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.barValue}>{fmt(item.value, currency)}</Text>
                </View>
                <View style={s.barTrack}>
                  <Svg width="100%" height={8}>
                    <Rect x="0" y="0" width="100%" height="8" rx="4" fill={T.border} />
                    <Rect x="0" y="0" width={`${Math.max(6, item.ratio * 100)}%`} height="8" rx="4" fill={T.accent} />
                  </Svg>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
  loading: { color: T.textDim, fontSize: 14, fontWeight: "700" },
  error: { color: T.red, textAlign: "center", fontSize: 14, fontWeight: "700" },
  retryBtn: { marginTop: 8, backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "800" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: T.text, fontSize: 18, fontWeight: "900" },

  scroll: { padding: 16, paddingBottom: 36, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    ...cardElevated,
    width: "48%",
    padding: 12,
    minHeight: 92,
    justifyContent: "space-between",
  },
  cardLabel: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  cardValue: { color: T.text, fontSize: 18, fontWeight: "900" },
  cardSub: { color: T.textMuted, fontSize: 11, fontWeight: "700" },

  tipCard: { ...cardBase, padding: 14 },
  tipTitle: { color: T.text, fontSize: 15, fontWeight: "900", marginBottom: 6 },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingVertical: 8 },
  tipRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border },
  tipTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  tipRowTitle: { color: T.text, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  tipText: { color: T.textDim, fontSize: 12, fontWeight: "600" },
  priorityBadge: {
    color: T.red,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    borderWidth: 1,
    borderColor: `${T.red}66`,
    backgroundColor: `${T.red}24`,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },

  overviewHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  overviewModeBadge: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  overviewChartWrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    paddingVertical: 8,
    alignItems: "center",
  },
  chartAxisText: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  chartAxisXText: {
    color: T.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  pointerTooltip: {
    backgroundColor: "#0a0a0a",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  pointerTooltipValue: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  pointerTooltipMonth: {
    marginTop: 2,
    color: "#d2d2d2",
    fontSize: 11,
    fontWeight: "700",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    color: T.text,
    fontSize: 12,
    fontWeight: "700",
  },
  barRow: {
    paddingVertical: 7,
  },
  barRowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
    gap: 8,
  },
  barName: {
    flex: 1,
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
  },
  barValue: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
  },
  barTrack: {
    height: 8,
  },
});
