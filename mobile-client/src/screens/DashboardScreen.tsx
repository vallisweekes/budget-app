import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Pressable,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { DashboardData, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt, MONTH_NAMES_SHORT } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { SectionRow } from "@/components/Dashboard/SectionRow";
import BudgetDonutCard from "@/components/Dashboard/BudgetDonutCard";
import CategorySwipeCards from "@/components/Dashboard/CategorySwipeCards";

export default function DashboardScreen({ navigation }: { navigation: any }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categorySheet, setCategorySheet] = useState<{ id: string; name: string } | null>(null);
  const [aiTipIndex, setAiTipIndex] = useState(0);
  const [showAllTips, setShowAllTips] = useState(false);

  const currency = currencySymbol(settings?.currency);

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
          <ActivityIndicator size="large" color="#0f282f" />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="rgba(15,40,47,0.55)" />
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
  const incomeAfterAllocations = dashboard?.incomeAfterAllocations ?? 0;
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

  // Budget utilisation — match web client's StatsGrid logic
  // "Income" card = income left to budget (after allocations & debt payments)
  const amountLeftToBudget = incomeAfterAllocations;
  // "Amount Left" card = income left to budget minus expenses
  const amountAfterExpenses = amountLeftToBudget - totalExpenses;
  const isOverBudget = amountAfterExpenses < 0;

  const paidTotal = allExpenses.reduce((acc, e) => acc + (e.paidAmount ?? (e.paid ? e.amount : 0)), 0);
  const totalBudget = amountLeftToBudget > 0 ? amountLeftToBudget : totalIncome;

  const clampDay = (y: number, monthIndex: number, day: number) => {
    const lastDay = new Date(y, monthIndex + 1, 0).getDate();
    return new Date(y, monthIndex, Math.min(Math.max(1, day), lastDay));
  };

  const pay = payDate ?? 1;
  const monthIndex = monthNum - 1;
  const end = clampDay(year, monthIndex, pay);
  end.setDate(end.getDate() - 1);
  const start = clampDay(year, monthIndex - 1, pay);
  start.setDate(start.getDate() + 1);

  const rangeLabel = `${start.getDate()} ${MONTH_NAMES_SHORT[start.getMonth()]} - ${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]}`;

  // Upcoming payments & tips from server-computed insights
  const upcoming = (dashboard?.expenseInsights?.upcoming ?? []).filter((u) => {
    const n = String(u.name ?? "").trim().toLowerCase();
    // Explicitly hide the Housing rent line on Home.
    if (n === "housing: rent" || n === "houing: rent") return false;
    if (n.startsWith("housing") && n.includes("rent")) return false;
    return true;
  });
  const tips = dashboard?.expenseInsights?.recapTips ?? [];

  useEffect(() => {
    if (aiTipIndex >= tips.length) setAiTipIndex(0);
  }, [tips.length, aiTipIndex]);

  useEffect(() => {
    if (tips.length <= 1) return;
    const id = setInterval(() => {
      setAiTipIndex((i) => (i + 1) % tips.length);
    }, 20_000);
    return () => clearInterval(id);
  }, [tips.length]);

  const getDebtDueAmount = (d: (typeof debts)[number]) => {
    // Match web-client getDebtMonthlyPayment()
    if ((d.installmentMonths ?? 0) > 0 && (d.currentBalance ?? 0) > 0) {
      const installment = (d.currentBalance ?? 0) / (d.installmentMonths ?? 1);
      const min = d.monthlyMinimum ?? 0;
      const eff = min > installment ? min : installment;
      return Math.min(d.currentBalance ?? 0, eff);
    }
    if ((d.monthlyMinimum ?? 0) > 0) {
      return Math.min(d.currentBalance ?? 0, d.monthlyMinimum ?? 0);
    }
    return Math.min(d.currentBalance ?? 0, d.amount ?? 0);
  };

  const upcomingDebts = debts
    .filter((d) => (d.currentBalance ?? 0) > 0)
    .map((d) => ({ ...d, dueAmount: getDebtDueAmount(d) }))
    .filter((d) => (d.dueAmount ?? 0) > 0)
    .sort((a, b) => (b.dueAmount ?? 0) - (a.dueAmount ?? 0));

  const formatShortDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
  };

  const selectedCategory = categorySheet ? categories.find((c) => c.id === categorySheet.id) : undefined;
  const selectedExpenses = (selectedCategory?.expenses ?? []).slice().sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <Modal
        visible={!!categorySheet}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setCategorySheet(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCategorySheet(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {categorySheet?.name ?? "Category"}
              </Text>
              <Pressable onPress={() => setCategorySheet(null)} hitSlop={10} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </Pressable>
            </View>

            <FlatList
              data={selectedExpenses}
              keyExtractor={(i) => i.id}
              contentContainerStyle={styles.sheetList}
              ListEmptyComponent={() => (
                <Text style={styles.sheetEmpty}>No expenses in this category.</Text>
              )}
              renderItem={({ item }) => (
                <View style={styles.sheetRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.sheetRowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.sheetRowSub}>{item.paid ? "paid" : "unpaid"}</Text>
                  </View>
                  <Text style={styles.sheetRowAmt} numberOfLines={1}>
                    {fmt(item.amount, currency)}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f282f" />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.rangePill}>
          <Text style={styles.rangeText}>{rangeLabel}</Text>
        </View>

        <BudgetDonutCard
          totalBudget={totalBudget}
          totalExpenses={totalExpenses}
          paidTotal={paidTotal}
          currency={currency}
          fmt={fmt}
        />

        <CategorySwipeCards
          categories={categories}
          totalIncome={totalIncome}
          currency={currency}
          fmt={fmt}
          onPressCategory={(c) => setCategorySheet(c)}
        />

        {/* Upcoming Payments (show 3 + See all) */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Expenses</Text>
            {upcoming.slice(0, 3).map((p) => {
              const dateLabel = formatShortDate(p.dueDate);
              const sub =
                p.urgency === "overdue"
                  ? "Overdue"
                  : p.urgency === "today"
                    ? "Due today"
                    : dateLabel
                      ? `Next on ${dateLabel}`
                      : `In ${p.daysUntilDue}d`;

              return (
                <View key={p.id} style={styles.lightRow}>
                  <View style={styles.lightLeft}>
                    <View style={styles.lightAvatar}>
                      <Text style={styles.lightAvatarTxt}>{(p.name?.trim()?.[0] ?? "?").toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lightRowTitle} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.lightRowSub} numberOfLines={1}>
                        {sub}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.lightRowAmt} numberOfLines={1}>
                    {fmt(p.amount, currency)}
                  </Text>
                </View>
              );
            })}
            <Pressable onPress={() => navigation.navigate("Payments")} style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          </View>
        )}

        {/* Upcoming Debts */}
        {upcomingDebts.length > 0 && (
          <View style={[styles.section, styles.blueSection]}>
            <Text style={[styles.sectionTitle, styles.blueSectionTitle]}>Upcoming Debts</Text>
            {upcomingDebts.slice(0, 5).map((d) => (
              <View key={d.id} style={styles.blueRow}>
                <View style={styles.blueLeft}>
                  <View style={styles.blueAvatar}>
                    <Text style={styles.blueAvatarTxt}>{(d.name?.trim()?.[0] ?? "D").toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.blueRowTitle} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={styles.blueRowSub} numberOfLines={1}>
                      Monthly payment
                    </Text>
                  </View>
                </View>
                <Text style={styles.blueRowAmt} numberOfLines={1}>
                  {fmt(d.dueAmount, currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Goals */}
        {(homepageGoals.length > 0 || goals.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Goals</Text>
            {(homepageGoals.length > 0 ? homepageGoals : goals.slice(0, 3)).map((g) => (
              <View key={g.id} style={styles.goalWrap}>
                <SectionRow
                  label={g.title}
                  value={
                    g.targetAmount
                      ? `${fmt(g.currentAmount ?? 0, currency)} / ${fmt(g.targetAmount, currency)}`
                      : g.type
                  }
                />
                {g.targetAmount ? (
                  <View style={styles.goalBarBg}>
                    <View
                      style={[
                        styles.goalBarFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.max(0, (((g.currentAmount ?? 0) / (g.targetAmount || 1)) * 100) || 0),
                          )}%` as `${number}%`,
                        },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Tips / Insights */}
        {tips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insights</Text>
            {(() => {
              const tip = tips[aiTipIndex] ?? tips[0];
              const message = String(tip?.detail ?? tip?.title ?? "").trim();
              return (
                <View style={styles.aiCard}>
                  <View style={styles.aiHeader}>
                    <View style={styles.aiIconWrap}>
                      <Ionicons name="sparkles-outline" size={16} color={T.accent} />
                    </View>
                    <Text style={styles.aiTitle}>Ai Insight</Text>
                  </View>

                  <Text style={styles.aiMessage} numberOfLines={3}>
                    {message}
                  </Text>

                  <Pressable
                    onPress={() => setShowAllTips((v) => !v)}
                    style={({ pressed }) => [styles.aiBtn, pressed && styles.aiBtnPressed]}
                  >
                    <Text style={styles.aiBtnText}>View Tips</Text>
                  </Pressable>

                  {showAllTips ? (
                    <View style={{ marginTop: 10 }}>
                      {tips.map((t, i) => (
                        <View key={i} style={styles.tipRow}>
                          <Ionicons name="bulb-outline" size={16} color={T.orange} style={{ marginTop: 2 }} />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.tipTitle}>{t.title}</Text>
                            <Text style={styles.tipDetail}>{t.detail}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })()}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#3f4bdc",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    maxHeight: "82%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)",
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.16)",
  },
  sheetTitle: { color: "rgba(255,255,255,0.96)", fontSize: 18, fontWeight: "900", flex: 1 },
  sheetCloseBtn: { marginLeft: 12 },
  sheetList: { paddingHorizontal: 16, paddingBottom: 24 },
  sheetEmpty: { color: "rgba(255,255,255,0.70)", fontSize: 13, fontStyle: "italic", paddingVertical: 12 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.16)",
  },
  sheetRowName: { color: "rgba(255,255,255,0.94)", fontSize: 14, fontWeight: "800" },
  sheetRowSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: "700", marginTop: 2 },
  sheetRowAmt: { color: "rgba(255,255,255,0.94)", fontSize: 16, fontWeight: "900" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { padding: 16, paddingTop: 18, paddingBottom: 140 },
  headerRow: { marginBottom: 14 },
  rangePill: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
    marginBottom: 12,
  },
  rangeText: { color: "rgba(15,40,47,0.70)", fontSize: 12, fontWeight: "800" },
  seeAllBtn: {
    marginTop: 6,
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(15,40,47,0.10)",
  },
  seeAllText: { color: T.accent, fontSize: 14, fontWeight: "900" },
  period: { color: "#0f282f", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  sectionTitle: {
    color: "rgba(15,40,47,0.55)",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10,
  },

  // Upcoming Expenses (white card) rows
  lightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15,40,47,0.10)",
    gap: 12,
  },
  lightLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  lightAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightAvatarTxt: { color: "#0f282f", fontSize: 14, fontWeight: "800" },
  lightRowTitle: { color: "#0f282f", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  lightRowSub: { color: "rgba(15,40,47,0.55)", fontSize: 13, fontWeight: "600", marginTop: 2 },
  lightRowAmt: { color: "#0f282f", fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },

  // Upcoming Debts (blue card)
  blueSection: {
    backgroundColor: "#3f4bdc",
    borderColor: "rgba(255,255,255,0.16)",
  },
  blueSectionTitle: {
    color: "rgba(255,255,255,0.78)",
  },
  blueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.16)",
    gap: 14,
  },
  blueLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 14 },
  blueAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  blueAvatarTxt: { color: "#3f4bdc", fontSize: 14, fontWeight: "800" },
  blueRowTitle: { color: "rgba(255,255,255,0.96)", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  blueRowSub: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "600", marginTop: 2 },
  blueRowAmt: { color: "rgba(255,255,255,0.96)", fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  loadingText: { color: "rgba(15,40,47,0.55)", marginTop: 12, fontSize: 14 },
  errorText: { color: "#e25c5c", marginTop: 12, fontSize: 15, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { marginTop: 16, backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: T.onAccent, fontWeight: "700" },
  emptyText: { color: "rgba(15,40,47,0.55)", fontSize: 13, fontStyle: "italic", paddingVertical: 6, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(15,40,47,0.10)", marginVertical: 10 },
  tipRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(15,40,47,0.10)" },
  tipTitle: { color: "#0f282f", fontSize: 13, fontWeight: "800" },
  tipDetail: { color: "rgba(15,40,47,0.62)", fontSize: 12, marginTop: 2, fontWeight: "600" },

  aiCard: {
    backgroundColor: T.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
  },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  aiTitle: { color: T.text, fontSize: 16, fontWeight: "900" },
  aiMessage: {
    marginTop: 10,
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
  },
  aiBtn: {
    marginTop: 12,
    backgroundColor: T.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBtnPressed: { transform: [{ scale: 0.99 }] },
  aiBtnText: { color: T.onAccent, fontSize: 13, fontWeight: "900" },

  goalWrap: { gap: 8 },
  goalBarBg: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15,40,47,0.10)",
    overflow: "hidden",
    marginBottom: 6,
  },
  goalBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: T.accent,
  },
});
