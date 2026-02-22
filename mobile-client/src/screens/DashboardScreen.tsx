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

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { Settings, Expense } from "@/lib/apiTypes";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function fmt(val: string | null | undefined, currency = "$"): string {
  const n = parseFloat(val ?? "0");
  if (isNaN(n)) return `${currency}0.00`;
  return `${currency}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardScreen() {
  const { username, signOut } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const currency = settings?.currency ?? "$";

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, e] = await Promise.all([
        apiFetch<Settings>("/api/bff/settings"),
        apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}`),
      ]);
      setSettings(s);
      setExpenses(Array.isArray(e) ? e : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f6cf7" />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
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

  const totalSpent = expenses.reduce((s, e) => s + parseFloat(e.amount ?? "0"), 0);
  const allowance = parseFloat(settings?.monthlyAllowance ?? "0") || 0;
  const remaining = allowance - totalSpent;
  const paidCount = expenses.filter((e) => e.paid).length;
  const unpaidCount = expenses.length - paidCount;
  const progressPct = allowance > 0 ? Math.min(100, (totalSpent / allowance) * 100) : 0;
  const isOverBudget = remaining < 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f6cf7" />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hello, {username ?? "there"} 👋</Text>
            <Text style={styles.period}>{MONTH_NAMES[month - 1]} {year}</Text>
          </View>
          <Pressable onPress={signOut} style={styles.signOutBtn}>
            <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>

        {/* Summary cards */}
        <View style={styles.grid}>
          <StatCard
            label="Allowance"
            value={fmt(settings?.monthlyAllowance, currency)}
            icon="wallet-outline"
            accent="#4f6cf7"
          />
          <StatCard
            label="Spent"
            value={fmt(String(totalSpent), currency)}
            icon="trending-up-outline"
            accent="#e25c5c"
          />
          <StatCard
            label="Remaining"
            value={fmt(String(remaining), currency)}
            icon="checkmark-circle-outline"
            accent={isOverBudget ? "#e25c5c" : "#3ec97e"}
            negative={isOverBudget}
          />
          <StatCard
            label="Expenses"
            value={String(expenses.length)}
            icon="receipt-outline"
            accent="#f4a942"
          />
        </View>

        {/* Budget progress bar */}
        {allowance > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Budget used</Text>
              <Text style={[styles.progressPct, isOverBudget && styles.overBudget]}>
                {progressPct.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPct}%` as `${number}%`,
                    backgroundColor: isOverBudget ? "#e25c5c" : "#4f6cf7",
                  },
                ]}
              />
            </View>
            <Text style={styles.progressSub}>
              {isOverBudget
                ? `Over budget by ${fmt(String(Math.abs(remaining)), currency)}`
                : `${fmt(String(remaining), currency)} left for this month`}
            </Text>
          </View>
        )}

        {/* Expense breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <Row label="Paid" value={`${paidCount}`} sub={`of ${expenses.length}`} />
          <Row label="Unpaid" value={`${unpaidCount}`} />
          {settings?.payDate && (
            <Row label="Pay date" value={`${settings.payDate}th of month`} />
          )}
          {settings?.budgetStrategy && (
            <Row label="Strategy" value={settings.budgetStrategy} />
          )}
        </View>

        {/* Savings */}
        {(settings?.savingsBalance || settings?.monthlySavingsContribution) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Savings</Text>
            {settings.savingsBalance && (
              <Row label="Balance" value={fmt(settings.savingsBalance, currency)} />
            )}
            {settings.monthlySavingsContribution && (
              <Row label="Monthly contribution" value={fmt(settings.monthlySavingsContribution, currency)} />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

type StatCardProps = {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent: string;
  negative?: boolean;
};

function StatCard({ label, value, icon, accent, negative = false }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      <Ionicons name={icon} size={18} color={accent} style={styles.statIcon} />
      <Text style={[styles.statValue, negative && { color: "#e25c5c" }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#070e1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { padding: 16, paddingBottom: 40 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: { color: "#fff", fontSize: 22, fontWeight: "700" },
  period: { color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 3 },
  signOutBtn: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: "#111d30",
    borderRadius: 14,
    padding: 16,
    borderTopWidth: 3,
  },
  statIcon: { marginBottom: 8, opacity: 0.9 },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 2 },
  statLabel: { color: "rgba(255,255,255,0.4)", fontSize: 12 },

  progressCard: {
    backgroundColor: "#111d30",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  progressTitle: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600" },
  progressPct: { color: "#fff", fontSize: 14, fontWeight: "700" },
  overBudget: { color: "#e25c5c" },
  progressBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  progressSub: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 8 },

  section: {
    backgroundColor: "#111d30",
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  rowLabel: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  rowValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  rowSub: { color: "rgba(255,255,255,0.3)", fontSize: 12 },

  loadingText: { color: "rgba(255,255,255,0.4)", marginTop: 12, fontSize: 14 },
  errorText: { color: "#e25c5c", marginTop: 12, fontSize: 15, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { marginTop: 16, backgroundColor: "#4f6cf7", borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: "#fff", fontWeight: "700" },
});
