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

      const [sumData, s, bp] = await Promise.all([
        apiFetch<ExpenseSummary>(`/api/bff/expenses/summary?month=${month}&year=${year}${planQp}`),
        apiFetch<Settings>("/api/bff/settings"),
        apiFetch<BudgetPlansResponse>("/api/bff/budget-plans"),
      ]);
      setSummary(sumData);
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

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <MonthBar
        month={month} year={year}
        onPrev={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        prevDisabled={!canDecrement(year, month)}
      />

      {plans.length > 1 && (
        <View style={styles.planBarWrap} {...planSwipe.panHandlers}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.planBar}
          >
            {plans.map((p) => {
              const selected = (activePlanId ?? personalPlanId) === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedPlanId(p.id)}
                  style={[styles.planPill, selected && styles.planPillSelected]}
                  hitSlop={6}
                >
                  <Text style={[styles.planPillText, selected && styles.planPillTextSelected]} numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

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
                <View style={styles.totalCard}>
                  <Text style={styles.totalLabel}>TOTAL</Text>
                  <Text style={styles.totalValue}>{fmt(summary.totalAmount ?? 0, currency)}</Text>
                  <Text style={styles.totalMeta}>
                    {summary.totalCount ?? 0} bill{(summary.totalCount ?? 0) === 1 ? "" : "s"}
                  </Text>
                </View>
              )}

              {!isPersonalPlan && plans.length > 1 && (summary?.totalCount ?? 0) === 0 && (
                <View style={styles.noExpensesCard}>
                  <Text style={styles.noExpensesTitle}>No expense for this month</Text>
                  <Text style={styles.noExpensesSub}>
                    {monthName(month)} {year}
                  </Text>
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

  planBarWrap: {
    backgroundColor: T.card,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  planBar: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  planPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    maxWidth: 160,
  },
  planPillSelected: {
    backgroundColor: T.accentDim,
    borderColor: T.accent,
  },
  planPillText: {
    color: T.textDim,
    fontWeight: "800",
    fontSize: 13,
  },
  planPillTextSelected: {
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

  totalCard: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: T.accentBorder,
  },
  totalLabel: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  totalValue: {
    marginTop: 8,
    color: T.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  totalMeta: {
    marginTop: 4,
    color: T.textDim,
    fontSize: 14,
    fontWeight: "700",
  },

  // (Additional-plan per-expense list styles removed; we now show the category cards instead.)
});
