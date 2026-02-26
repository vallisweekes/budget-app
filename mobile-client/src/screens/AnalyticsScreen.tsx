import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect } from "react-native-svg";
import { LineChart } from "react-native-gifted-charts";

import { apiFetch } from "@/lib/api";
import type { DashboardData, DebtSummaryData, ExpenseSummary, IncomeSummaryData, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";

import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";

const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const OVERVIEW_CHART_W = Math.max(240, Dimensions.get("window").width - 76);
const OVERVIEW_CHART_H = 180;

export default function AnalyticsScreen({ navigation }: { navigation: any }) {
  const topHeaderOffset = useTopHeaderOffset();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [debt, setDebt] = useState<DebtSummaryData | null>(null);
  const [income, setIncome] = useState<IncomeSummaryData | null>(null);
  const [expensesByMonth, setExpensesByMonth] = useState<number[]>(Array(12).fill(0));
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overviewMode, setOverviewMode] = useState<"month" | "year">("year");
  const toggleAnim = useRef(new Animated.Value(1)).current; // 0=month, 1=year

  useEffect(() => {
    Animated.spring(toggleAnim, {
      toValue: overviewMode === "year" ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [overviewMode, toggleAnim]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const year = new Date().getFullYear();
      const [dash, debtSummary, incomeSummary, s] = await Promise.all([
        apiFetch<DashboardData>("/api/bff/dashboard"),
        apiFetch<DebtSummaryData>("/api/bff/debt-summary"),
        apiFetch<IncomeSummaryData>(`/api/bff/income-summary?year=${year}`),
        apiFetch<Settings>("/api/bff/settings"),
      ]);

      const planQp = dash?.budgetPlanId ? `&budgetPlanId=${encodeURIComponent(dash.budgetPlanId)}` : "";
      const expenseSeries = await Promise.all(
        Array.from({ length: 12 }, async (_, idx) => {
          try {
            const summary = await apiFetch<ExpenseSummary>(`/api/bff/expenses/summary?month=${idx + 1}&year=${year}${planQp}`);
            return summary?.totalAmount ?? 0;
          } catch {
            return 0;
          }
        })
      );

      setDashboard(dash);
      setDebt(debtSummary);
      setIncome(incomeSummary);
      setExpensesByMonth(expenseSeries);
      setSettings(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currency = currencySymbol(settings?.currency);

  const insightRows = useMemo(() => {
    const totalIncome = dashboard?.totalIncome ?? 0;
    const totalExpenses = dashboard?.totalExpenses ?? 0;
    const totalDebt = debt?.totalDebtBalance ?? 0;
    const monthlyDebt = debt?.totalMonthlyDebtPayments ?? 0;
    const upcomingCount = dashboard?.expenseInsights?.upcoming?.length ?? 0;
    const monthsWithIncome = income?.monthsWithIncome ?? 0;
    const debtLoadPct = totalIncome > 0 ? Math.min(100, Math.round((monthlyDebt / totalIncome) * 100)) : 0;

    return [
      { label: "Income", value: fmt(totalIncome, currency), sub: `${monthsWithIncome}/12 months funded` },
      { label: "Expenses", value: fmt(totalExpenses, currency), sub: `${upcomingCount} upcoming payments` },
      { label: "Debt", value: fmt(totalDebt, currency), sub: `${debt?.activeCount ?? 0} active debts` },
      { label: "Debt Load", value: `${debtLoadPct}%`, sub: `${fmt(monthlyDebt, currency)} / month` },
    ];
  }, [currency, dashboard, debt, income]);

  const topTips = useMemo(() => {
    const expenseTips = (dashboard?.expenseInsights?.recapTips ?? []).slice(0, 3);
    const debtTips = (debt?.tips ?? []).slice(0, 2);
    return [...expenseTips, ...debtTips].slice(0, 4);
  }, [dashboard?.expenseInsights?.recapTips, debt?.tips]);

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
        labels: MONTH_SHORT.map((label, idx) => (idx % 2 === 0 ? label : "")),
        rawLabels: MONTH_SHORT,
        incomeSeries: incomeYear,
        expenseSeries: expensesByMonth,
        maxValue,
      };
    }

    const now = new Date();
    const currentIdx = now.getMonth();
    const prevIdx = (currentIdx + 11) % 12;
    const currentIncome = incomeYear[currentIdx] ?? 0;
    const prevIncome = incomeYear[prevIdx] ?? 0;
    const currentExpense = dashboard?.totalExpenses ?? expensesByMonth[currentIdx] ?? 0;
    const prevExpense = dashboard?.expenseInsights?.recap?.totalAmount ?? expensesByMonth[prevIdx] ?? 0;

    const incomeSeries = [prevIncome, currentIncome];
    const expenseSeries = [prevExpense, currentExpense];
    const maxValue = Math.max(...incomeSeries, ...expenseSeries, 1);

    return {
      labels: [MONTH_SHORT[prevIdx], MONTH_SHORT[currentIdx]],
      rawLabels: [MONTH_SHORT[prevIdx], MONTH_SHORT[currentIdx]],
      incomeSeries,
      expenseSeries,
      maxValue,
    };
  }, [dashboard?.expenseInsights?.recap?.totalAmount, dashboard?.totalExpenses, expensesByMonth, income?.months, overviewMode]);

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

  const chartSpacing = overviewMode === "year" ? 23 : 140;

  const debtDistribution = useMemo(() => {
    const topDebts = [...(debt?.debts ?? [])]
      .filter((item) => item.currentBalance > 0)
      .sort((a, b) => b.currentBalance - a.currentBalance)
      .slice(0, 5);
    const max = Math.max(...topDebts.map((item) => item.currentBalance), 1);
    return topDebts.map((item) => ({
      id: item.id,
      name: item.name,
      value: item.currentBalance,
      ratio: item.currentBalance / max,
    }));
  }, [debt?.debts]);

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
          <Pressable onPress={load} style={s.retryBtn}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />}
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
            <Pressable
              onPress={() => setOverviewMode(overviewMode === "month" ? "year" : "month")}
              style={s.overviewToggle}
            >
              <Animated.View
                style={[
                  s.overviewThumb,
                  { transform: [{ translateX: toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 34] }) }] },
                ]}
              />
              <View style={s.overviewModeBtn}>
                <Text style={[s.overviewModeText, overviewMode === "month" && s.overviewModeTextActive]}>M</Text>
              </View>
              <View style={s.overviewModeBtn}>
                <Text style={[s.overviewModeText, overviewMode === "year" && s.overviewModeTextActive]}>Y</Text>
              </View>
            </Pressable>
          </View>

          <View style={s.overviewChartWrap}>
            <LineChart
              data={overviewIncomeLine}
              data2={overviewExpenseLine}
              curved
              color1="#2c91ff"
              color2="#ef4fa6"
              thickness={2}
              thickness2={2}
              height={OVERVIEW_CHART_H}
              width={OVERVIEW_CHART_W - 20}
              initialSpacing={6}
              spacing={chartSpacing}
              noOfSections={5}
              maxValue={overviewMaxValue}
              yAxisColor={T.border}
              xAxisColor={T.border}
              yAxisTextStyle={s.chartAxisText}
              xAxisLabelTextStyle={s.chartAxisText}
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
          <Text style={s.tipTitle}>Debt Distribution</Text>
          {debtDistribution.length === 0 ? (
            <Text style={s.tipText}>No active debt balances.</Text>
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
  overviewToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    backgroundColor: T.card,
    width: 68,
    height: 34,
    position: "relative",
  },
  overviewThumb: {
    position: "absolute",
    width: 30,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.accent,
    top: 2,
  },
  overviewModeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewModeBtnActive: {
    backgroundColor: T.accent,
    borderColor: T.accent,
  },
  overviewModeText: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "800",
  },
  overviewModeTextActive: {
    color: T.onAccent,
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
