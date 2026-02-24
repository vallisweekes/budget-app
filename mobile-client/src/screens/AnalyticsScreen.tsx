import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polyline, Rect } from "react-native-svg";

import { apiFetch } from "@/lib/api";
import type { DashboardData, DebtSummaryData, IncomeSummaryData, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";

const SPARKLINE_WIDTH = 220;
const SPARKLINE_HEIGHT = 68;

function toSparklinePoints(values: number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const spread = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? SPARKLINE_WIDTH / 2 : (index / (values.length - 1)) * SPARKLINE_WIDTH;
      const y = SPARKLINE_HEIGHT - ((value - min) / spread) * SPARKLINE_HEIGHT;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function AnalyticsScreen({ navigation }: { navigation: any }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [debt, setDebt] = useState<DebtSummaryData | null>(null);
  const [income, setIncome] = useState<IncomeSummaryData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setDashboard(dash);
      setDebt(debtSummary);
      setIncome(incomeSummary);
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

  const incomeTrend = useMemo(() => {
    const months = [...(income?.months ?? [])]
      .sort((a, b) => a.monthIndex - b.monthIndex)
      .slice(-6);
    const values = months.map((month) => month.total);
    const labels = months.map((month) => month.monthKey.slice(0, 3));
    return {
      labels,
      values,
      points: toSparklinePoints(values),
      max: Math.max(...values, 0),
      min: Math.min(...values, 0),
    };
  }, [income?.months]);

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
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.loading}>Loading analytics…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
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
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <Text style={s.title}>Analytics</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
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
          <Text style={s.tipTitle}>Top Insights</Text>
          {topTips.length === 0 ? (
            <Text style={s.tipText}>No insights yet.</Text>
          ) : (
            topTips.map((tip, idx) => (
              <View key={`${tip.title}-${idx}`} style={[s.tipRow, idx > 0 && s.tipRowBorder]}>
                <Ionicons name="sparkles-outline" size={14} color={T.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={s.tipRowTitle}>{tip.title}</Text>
                  <Text style={s.tipText}>{tip.detail}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={s.tipCard}>
          <Text style={s.tipTitle}>Income Trend (6 months)</Text>
          {incomeTrend.values.length < 2 ? (
            <Text style={s.tipText}>Not enough income history yet.</Text>
          ) : (
            <>
              <View style={s.sparklineWrap}>
                <Svg width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT}>
                  <Polyline
                    points={incomeTrend.points}
                    fill="none"
                    stroke={T.accent}
                    strokeWidth={3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
              <View style={s.sparklineMeta}>
                <Text style={s.sparklineText}>Low: {fmt(incomeTrend.min, currency)}</Text>
                <Text style={s.sparklineText}>High: {fmt(incomeTrend.max, currency)}</Text>
              </View>
              <View style={s.sparklineLabels}>
                {incomeTrend.labels.map((label) => (
                  <Text key={label} style={s.sparklineLabel}>{label}</Text>
                ))}
              </View>
            </>
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
  tipRowTitle: { color: T.text, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  tipText: { color: T.textDim, fontSize: 12, fontWeight: "600" },

  sparklineWrap: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: `${T.accent}14`,
    paddingVertical: 8,
    alignItems: "center",
  },
  sparklineMeta: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sparklineText: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
  sparklineLabels: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sparklineLabel: {
    color: T.textMuted,
    fontSize: 10,
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
