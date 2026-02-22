import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { DashboardData, Settings } from "@/lib/apiTypes";
import { fmt, MONTH_NAMES_LONG, ordinalSuffix } from "@/lib/formatting";
import { StatCard } from "@/components/Dashboard/StatCard";
import { SectionRow } from "@/components/Dashboard/SectionRow";
import { BudgetProgress } from "@/components/Dashboard/BudgetProgress";

export default function DashboardScreen() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = settings?.currency ?? "$";

  const load = useCallback(async () => {
    try {
      setError(null);
      // Fetch computed dashboard + settings in parallel.
      // All budget calculations happen server-side — same logic as the web client.
      const [dash, s] = await Promise.all([
        apiFetch<DashboardData>("/api/bff/dashboard"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setDashboard(dash);
      setSettings(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#02eff0" />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="#455" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // All values are pre-computed server-side — no client-side math needed
  const totalIncome = dashboard?.totalIncome ?? 0;
  const totalExpenses = dashboard?.totalExpenses ?? 0;
  const remaining = dashboard?.remaining ?? 0;
  const totalAllocations = dashboard?.totalAllocations ?? 0;
  const incomeAfterAllocations = dashboard?.incomeAfterAllocations ?? 0;
  const plannedSavings = dashboard?.plannedSavingsContribution ?? 0;
  const plannedEmergency = dashboard?.plannedEmergencyContribution ?? 0;
  const plannedInvestments = dashboard?.plannedInvestments ?? 0;
  const plannedDebt = dashboard?.plannedDebtPayments ?? 0;
  const totalDebtBalance = dashboard?.totalDebtBalance ?? 0;
  const categories = dashboard?.categoryData ?? [];
  const goals = dashboard?.goals ?? [];
  const debts = dashboard?.debts ?? [];
  const homepageGoals = goals.filter((g) =>
    dashboard?.homepageGoalIds?.includes(g.id)
  );
  const monthNum = dashboard?.monthNum ?? new Date().getMonth() + 1;
  const year = dashboard?.year ?? new Date().getFullYear();
  const payDate = dashboard?.payDate ?? settings?.payDate ?? 1;

  // Expense stats from category data
  const allExpenses = categories.flatMap((c) => c.expenses);
  const paidCount = allExpenses.filter((e) => e.paid).length;
  const unpaidCount = allExpenses.length - paidCount;

  // Budget utilisation — match web client's StatsGrid logic
  // "Income" card = income left to budget (after allocations & debt payments)
  const amountLeftToBudget = incomeAfterAllocations;
  // "Amount Left" card = income left to budget minus expenses
  const amountAfterExpenses = amountLeftToBudget - totalExpenses;
  const progressPct = totalIncome > 0 ? Math.min(100, (totalExpenses / totalIncome) * 100) : 0;
  const isOverBudget = amountAfterExpenses < 0;

  // Upcoming payments & tips from server-computed insights
  const upcoming = dashboard?.expenseInsights?.upcoming ?? [];
  const tips = dashboard?.expenseInsights?.recapTips ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#02eff0" />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.period}>{MONTH_NAMES_LONG[monthNum - 1]} {year}</Text>
        </View>

        {/* Summary cards — matches web client StatsGrid */}
        <View style={styles.grid}>
          <StatCard label="Income" value={fmt(amountLeftToBudget, currency)} icon="wallet-outline" accent="#02eff0" />
          <StatCard label="Expenses" value={fmt(totalExpenses, currency)} icon="trending-up-outline" accent="#e25c5c" />
          <StatCard label="Amount Left" value={fmt(amountAfterExpenses, currency)} icon="checkmark-circle-outline" accent={isOverBudget ? "#e25c5c" : "#3ec97e"} negative={isOverBudget} />
          <StatCard label="Savings" value={fmt(plannedSavings, currency)} icon="cash-outline" accent="#3ec97e" />
        </View>

        <BudgetProgress progressPct={progressPct} isOverBudget={isOverBudget} amountAfterExpenses={amountAfterExpenses} currency={currency} fmt={fmt} />

        {/* Allocations */}
        {totalAllocations > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Allocations</Text>
            {plannedSavings > 0 && <SectionRow label="Savings" value={fmt(plannedSavings, currency)} />}
            {plannedEmergency > 0 && <SectionRow label="Emergency" value={fmt(plannedEmergency, currency)} />}
            {plannedInvestments > 0 && <SectionRow label="Investments" value={fmt(plannedInvestments, currency)} />}
            {plannedDebt > 0 && <SectionRow label="Debt payments" value={fmt(plannedDebt, currency)} />}
            <SectionRow label="Total" value={fmt(totalAllocations, currency)} />
          </View>
        )}

        {/* Expense breakdown by category */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses by Category</Text>
          {categories.length > 0 ? (
            categories.map((cat) => (
              <SectionRow key={cat.id} label={cat.name} value={fmt(cat.total, currency)} />
            ))
          ) : (
            <Text style={styles.emptyText}>No expenses this month</Text>
          )}
          <View style={styles.divider} />
          <SectionRow label="Paid" value={`${paidCount}`} sub={`of ${allExpenses.length}`} />
          <SectionRow label="Unpaid" value={`${unpaidCount}`} />
          <SectionRow label="Pay date" value={`${payDate}${ordinalSuffix(payDate)} of month`} />
        </View>

        {/* Debts */}
        {debts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Debts</Text>
            {debts.slice(0, 5).map((d) => (
              <SectionRow key={d.id} label={d.name} value={fmt(d.currentBalance, currency)} />
            ))}
            <View style={styles.divider} />
            <SectionRow label="Total balance" value={fmt(totalDebtBalance, currency)} />
          </View>
        )}

        {/* Upcoming Payments */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Payments</Text>
            {upcoming.slice(0, 5).map((p) => (
              <SectionRow
                key={p.id}
                label={p.name}
                value={fmt(p.amount, currency)}
                sub={p.urgency === "overdue" ? "overdue" : p.urgency === "today" ? "due today" : `${p.daysUntilDue}d`}
              />
            ))}
          </View>
        )}

        {/* Goals */}
        {(homepageGoals.length > 0 || goals.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Goals</Text>
            {(homepageGoals.length > 0 ? homepageGoals : goals.slice(0, 3)).map((g) => (
              <SectionRow
                key={g.id}
                label={g.title}
                value={
                  g.targetAmount
                    ? `${fmt(g.currentAmount ?? 0, currency)} / ${fmt(g.targetAmount, currency)}`
                    : g.type
                }
              />
            ))}
          </View>
        )}

        {/* Tips / Insights */}
        {tips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insights</Text>
            {tips.slice(0, 4).map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <Ionicons name="bulb-outline" size={16} color="#f4a942" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.tipTitle}>{tip.title}</Text>
                  <Text style={styles.tipDetail}>{tip.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f282f" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { padding: 16, paddingBottom: 140 },
  headerRow: { marginBottom: 16 },
  period: { color: "rgba(255,255,255,0.65)", fontSize: 15, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  section: { backgroundColor: "#0a1e23", borderRadius: 14, padding: 16, marginTop: 12 },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 12 },
  loadingText: { color: "rgba(255,255,255,0.4)", marginTop: 12, fontSize: 14 },
  errorText: { color: "#e25c5c", marginTop: 12, fontSize: 15, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { marginTop: 16, backgroundColor: "#02eff0", borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: "#fff", fontWeight: "700" },
  emptyText: { color: "rgba(255,255,255,0.3)", fontSize: 13, fontStyle: "italic", paddingVertical: 6 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 8 },
  tipRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  tipTitle: { color: "#fff", fontSize: 13, fontWeight: "600" },
  tipDetail: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 },
});
