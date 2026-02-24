/**
 * ExpensesScreen
 *
 * All financial calculations (totals, paid/unpaid, category breakdown) are
 * computed server-side via /api/bff/expenses/summary so this screen shares
 * the exact same logic as the web client — no client-side arithmetic.
 *
 * Currency comes from /api/bff/settings (never hardcoded).
 * Upcoming payments come from /api/bff/expense-insights.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  ScrollView,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { apiFetch } from "@/lib/api";
import type {
  Settings,
  ExpenseSummary,
  ExpenseCategoryBreakdown,
  BudgetPlansResponse,
  BudgetPlanListItem,
  ExpenseMonthsResponse,
} from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useYearGuard } from "@/lib/hooks/useYearGuard";
import { T } from "@/lib/theme";
import type { ExpensesStackParamList } from "@/navigation/types";
import MonthBar from "@/components/Shared/MonthBar";
import CategoryBreakdown from "@/components/Expenses/CategoryBreakdown";
import AddExpenseSheet from "@/components/Expenses/AddExpenseSheet";

/* ════════════════════════════════════════════════════════════════
 * Screen
 * ════════════════════════════════════════════════════════════════ */

type Props = NativeStackScreenProps<ExpensesStackParamList, "ExpensesList">;

export default function ExpensesScreen({ navigation }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [plans, setPlans] = useState<BudgetPlanListItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [expenseMonths, setExpenseMonths] = useState<ExpenseMonthsResponse["months"]>([]);

  const [summary, setSummary]   = useState<ExpenseSummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<ExpenseSummary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Add-expense sheet
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const currency = currencySymbol(settings?.currency);
  const { canDecrement } = useYearGuard(settings);

  const personalPlanId = plans.find((p) => p.kind === "personal")?.id ?? null;
  const activePlanId = selectedPlanId ?? personalPlanId;
  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;
  const isPersonalPlan = !activePlan || activePlan.kind === "personal";
  const isAdditionalPlan = !isPersonalPlan && plans.length > 1;

  const planTotalAmount = expenseMonths.reduce((sum, m) => sum + (m.totalAmount ?? 0), 0);
  const planTotalCount = expenseMonths.reduce((sum, m) => sum + (m.totalCount ?? 0), 0);

  const prevIsPersonalPlanRef = useRef<boolean>(true);

  useEffect(() => {
    const wasPersonal = prevIsPersonalPlanRef.current;
    if (!wasPersonal && isPersonalPlan) {
      const d = new Date();
      setMonth(d.getMonth() + 1);
      setYear(d.getFullYear());
    }
    prevIsPersonalPlanRef.current = isPersonalPlan;
  }, [isPersonalPlan]);

  const activePlanIndex = Math.max(0, plans.findIndex((p) => p.id === activePlanId));
  const setPlanByIndex = (idx: number) => {
    if (!plans.length) return;
    const clamped = Math.max(0, Math.min(plans.length - 1, idx));
    const next = plans[clamped];
    if (next?.id) setSelectedPlanId(next.id);
  };

  const planSwipe = PanResponder.create({
    onMoveShouldSetPanResponder: (_evt, g) => {
      // Only capture clear horizontal swipes
      return Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
    },
    onPanResponderRelease: (_evt, g) => {
      if (Math.abs(g.dx) < 60) return;
      if (g.dx < 0) setPlanByIndex(activePlanIndex + 1);
      else setPlanByIndex(activePlanIndex - 1);
    },
  });

  const monthName = (m: number) => {
    const names = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return names[Math.max(1, Math.min(12, m)) - 1] ?? "";
  };

  useEffect(() => {
    // Default to the Personal plan when multiple plans exist.
    if (!selectedPlanId && personalPlanId) setSelectedPlanId(personalPlanId);
  }, [personalPlanId, selectedPlanId]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const planQp = activePlanId ? `&budgetPlanId=${encodeURIComponent(activePlanId)}` : "";

      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      const [sumData, prevData, s, bp] = await Promise.all([
        apiFetch<ExpenseSummary>(`/api/bff/expenses/summary?month=${month}&year=${year}${planQp}`),
        apiFetch<ExpenseSummary>(`/api/bff/expenses/summary?month=${prevMonth}&year=${prevYear}${planQp}`),
        apiFetch<Settings>("/api/bff/settings"),
        apiFetch<BudgetPlansResponse>("/api/bff/budget-plans"),
      ]);
      setSummary(sumData);
      setPreviousSummary(prevData);
      setSettings(s);

      const rawPlans = Array.isArray(bp?.plans) ? bp.plans : [];
      const nextPlans = rawPlans.slice().sort((a, b) => {
        const aPersonal = a.kind === "personal";
        const bPersonal = b.kind === "personal";
        if (aPersonal && !bPersonal) return -1;
        if (!aPersonal && bPersonal) return 1;
        // Keep stable-ish ordering for additional plans
        const aCreated = new Date(a.createdAt).getTime();
        const bCreated = new Date(b.createdAt).getTime();
        return aCreated - bCreated;
      });
      setPlans(nextPlans);

      // Only compute sparse month cards for additional (non-personal) plans.
      const resolvedPlanId = activePlanId ?? nextPlans.find((p) => p.kind === "personal")?.id ?? null;
      const resolvedActive = nextPlans.find((p) => p.id === resolvedPlanId) ?? null;
      const shouldLoadMonths = Boolean(resolvedPlanId && resolvedActive && resolvedActive.kind !== "personal" && nextPlans.length > 1);
      if (shouldLoadMonths) {
        const qp = `budgetPlanId=${encodeURIComponent(resolvedPlanId!)}`;
        const monthsData = await apiFetch<ExpenseMonthsResponse>(
          `/api/bff/expenses/months?${qp}`,
        );

        const months = Array.isArray(monthsData?.months) ? monthsData.months : [];
        // Show in chronological order (earliest → latest)
        months.sort((a, b) => (a.year - b.year) || (a.month - b.month));
        setExpenseMonths(months);
      } else {
        setExpenseMonths([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activePlanId, month, year]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Refresh when navigating back from CategoryExpensesScreen
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const changeMonth = (delta: number) => {
    if (delta < 0 && !canDecrement(year, month)) return;
    let m = month + delta, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m); setYear(y);
  };

  const handleCategoryPress = (cat: ExpenseCategoryBreakdown) => {
    navigation.navigate("CategoryExpenses", {
      categoryId: cat.categoryId,
      categoryName: cat.name,
      color: cat.color,
      icon: cat.icon,
      month,
      year,
      budgetPlanId: activePlanId,
      currency,
    });
  };

  const showTopAddExpenseCta = !loading && !error && (summary?.totalCount ?? 0) === 0;

  const showPlanTotalFallback =
    isAdditionalPlan &&
    (summary?.totalCount ?? 0) === 0 &&
    expenseMonths.length > 0 &&
    planTotalAmount > 0;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <MonthBar
        month={month} year={year}
        onPrev={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        prevDisabled={!canDecrement(year, month)}
      />

      {showTopAddExpenseCta ? (
        <View style={styles.actionCard}>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Add expense</Text>
            <Text style={styles.actionText}>Create a bill for {monthName(month)} {year}.</Text>
          </View>
          <Pressable onPress={() => setAddSheetOpen(true)} style={styles.actionBtn}>
            <Ionicons name="add" size={16} color={T.onAccent} />
            <Text style={styles.actionBtnText}>Add</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={T.textDim} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ""}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />
          }
          ListHeaderComponent={
            <>
              {summary && (
                <View style={styles.totalSummaryWrap}>
                  <Text style={styles.totalSummaryTitle}>
                    {showPlanTotalFallback ? "Plan expenses" : "This month expenses"}
                  </Text>
                  <Text style={styles.totalSummaryValue}>
                    {fmt(showPlanTotalFallback ? planTotalAmount : (summary.totalAmount ?? 0), currency)}
                  </Text>
                  <Text style={styles.totalSummaryMeta}>
                    {showPlanTotalFallback
                      ? `${planTotalCount} bill${planTotalCount === 1 ? "" : "s"}`
                      : `${summary.totalCount ?? 0} bill${(summary.totalCount ?? 0) === 1 ? "" : "s"}`}
                  </Text>
                  {(() => {
                    if (showPlanTotalFallback) return null;
                    const currentTotal = summary.totalAmount ?? 0;
                    const prevTotal = previousSummary?.totalAmount ?? 0;
                    if (prevTotal <= 0) return null;
                    const changePct = ((currentTotal - prevTotal) / prevTotal) * 100;
                    const up = changePct >= 0;
                    const pctLabel = `${up ? "↗" : "↘"} ${Math.abs(changePct).toFixed(1)}%`;
                    return (
                      <Text style={styles.totalSummaryDelta}>
                        <Text style={[styles.totalSummaryDeltaPct, up ? styles.deltaUp : styles.deltaDown]}>{pctLabel}</Text>
                        <Text style={styles.totalSummaryDeltaText}> vs last month</Text>
                      </Text>
                    );
                  })()}
                </View>
              )}

              {plans.length > 1 && (
                <View style={styles.planCardsWrap} {...planSwipe.panHandlers}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.planCardsScroll}
                  >
                    {plans.map((p) => {
                      const selected = (activePlanId ?? personalPlanId) === p.id;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => setSelectedPlanId(p.id)}
                          style={[styles.planCard, selected && styles.planCardSelected]}
                          hitSlop={6}
                        >
                          <Text style={[styles.planCardText, selected && styles.planCardTextSelected]} numberOfLines={2}>
                            {p.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {!isPersonalPlan && plans.length > 1 && (summary?.totalCount ?? 0) === 0 && (
                <View style={styles.noExpensesCard}>
                  <Text style={styles.noExpensesTitle}>No expense for this month</Text>
                  <Text style={styles.noExpensesSub}>
                    {monthName(month)} {year}
                  </Text>
                  <Text style={styles.noExpensesHint}>Tap Add above to create your first expense.</Text>
                </View>
              )}

              {summary && (
                <CategoryBreakdown
                  categories={summary.categoryBreakdown}
                  currency={currency}
                  fmt={fmt}
                  onCategoryPress={handleCategoryPress}
                  onAddPress={() => setAddSheetOpen(true)}
                />
              )}

              {!isPersonalPlan && plans.length > 1 && expenseMonths.length > 0 && (
                <>
                  <View style={styles.sectionHeadingWrap}>
                    <Text style={styles.sectionHeading}>Upcoming Months Expenses</Text>
                  </View>
                  <View style={styles.monthCardsWrap}>
                    {expenseMonths
                      .filter((m) => !(m.month === month && m.year === year))
                      .map((m) => {
                      return (
                        <Pressable
                          key={`${m.year}-${m.month}`}
                          onPress={() => {
                            setMonth(m.month);
                            setYear(m.year);
                          }}
                          style={styles.monthCard}
                        >
                          <View style={styles.monthCardRow}>
                            <Text style={styles.monthCardTitle}>{monthName(m.month)} {m.year}</Text>
                            <Text style={styles.monthCardAmount}>{fmt(m.totalAmount ?? 0, currency)}</Text>
                          </View>
                          <Text style={styles.monthCardMeta}>{m.totalCount} expense{m.totalCount === 1 ? "" : "s"}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          }
          renderItem={() => null}
        />
      )}

      <AddExpenseSheet
        visible={addSheetOpen}
        month={month}
        year={year}
        budgetPlanId={activePlanId}
        currency={currency}
        categories={summary?.categoryBreakdown ?? []}
        onAdded={() => { setAddSheetOpen(false); load(); }}
        onClose={() => setAddSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scrollContent: { paddingBottom: 140 },
  errorText: { color: "#e25c5c", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },

  actionCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  actionCopy: { flex: 1 },
  actionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  actionText: { marginTop: 2, color: T.textDim, fontSize: 12, fontWeight: "700" },
  actionBtn: {
    minWidth: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: T.accent,
  },
  actionBtnText: { color: T.onAccent, fontSize: 13, fontWeight: "800" },

  planCardsWrap: {
    marginTop: 32,
    marginBottom: 6,
  },
  planCardsScroll: {
    paddingHorizontal: 12,
    gap: 10,
  },
  planCard: {
    width: 116,
    minHeight: 76,
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  planCardSelected: {
    backgroundColor: T.accentDim,
    borderColor: T.accent,
  },
  planCardText: {
    color: T.textDim,
    fontWeight: "900",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 18,
  },
  planCardTextSelected: {
    color: T.text,
  },

  noExpensesCard: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: T.accentBorder,
  },
  noExpensesTitle: {
    color: T.text,
    fontWeight: "900",
    fontSize: 14,
  },
  noExpensesSub: {
    marginTop: 4,
    color: T.textDim,
    fontWeight: "700",
    fontSize: 12,
  },
  noExpensesHint: {
    marginTop: 6,
    color: T.textMuted,
    fontWeight: "600",
    fontSize: 12,
  },

  monthCardsWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  },
  sectionHeadingWrap: {
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  sectionHeading: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  monthCard: {
    backgroundColor: T.card,
    borderWidth: 2,
    borderColor: T.accentBorder,
    borderRadius: 16,
    padding: 16,
  },
  monthCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  monthCardTitle: {
    color: T.text,
    fontWeight: "900",
    fontSize: 14,
    flexShrink: 1,
  },
  monthCardAmount: {
    color: T.text,
    fontWeight: "900",
    fontSize: 14,
  },
  monthCardMeta: {
    marginTop: 6,
    color: T.textDim,
    fontWeight: "700",
    fontSize: 12,
  },

  totalSummaryWrap: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
    alignItems: "center",
  },
  totalSummaryTitle: {
    color: T.textDim,
    fontSize: 14,
    fontWeight: "700",
  },
  totalSummaryValue: {
    marginTop: 4,
    color: T.text,
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  totalSummaryMeta: {
    marginTop: 2,
    color: T.textDim,
    fontSize: 14,
    fontWeight: "700",
  },
  totalSummaryDelta: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
  },
  totalSummaryDeltaPct: {
    fontSize: 13,
    fontWeight: "900",
  },
  totalSummaryDeltaText: {
    color: T.textDim,
  },
  deltaUp: {
    color: "#2ecf70",
  },
  deltaDown: {
    color: T.red,
  },

  // (Additional-plan per-expense list styles removed; we now show the category cards instead.)
});
