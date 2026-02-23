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

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { Settings, ExpenseSummary, ExpenseInsights, UpcomingPayment, ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useYearGuard } from "@/lib/hooks/useYearGuard";
import { T } from "@/lib/theme";
import MonthBar from "@/components/Shared/MonthBar";
import ExpenseStatGrid from "@/components/Expenses/ExpenseStatGrid";
import CategoryBreakdown from "@/components/Expenses/CategoryBreakdown";
import UpcomingList from "@/components/Expenses/UpcomingList";
import CategoryExpensesSheet, { type SheetCategory } from "@/components/Expenses/CategoryExpensesSheet";

/* ════════════════════════════════════════════════════════════════
 * Screen
 * ════════════════════════════════════════════════════════════════ */

export default function ExpensesScreen() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [summary, setSummary]   = useState<ExpenseSummary | null>(null);
  const [insights, setInsights] = useState<ExpenseInsights | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Sheet state
  const [sheetCategory, setSheetCategory] = useState<SheetCategory | null>(null);
  const [sheetOpen, setSheetOpen]         = useState(false);

  const currency = currencySymbol(settings?.currency);
  const { canDecrement } = useYearGuard(settings);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [sumData, insData, s] = await Promise.all([
        apiFetch<ExpenseSummary>(`/api/bff/expenses/summary?month=${month}&year=${year}`),
        apiFetch<ExpenseInsights>("/api/bff/expense-insights"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setSummary(sumData);
      setInsights(insData);
      setSettings(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const changeMonth = (delta: number) => {
    if (delta < 0 && !canDecrement(year, month)) return;
    let m = month + delta, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m); setYear(y);
  };

  const upcoming: UpcomingPayment[] = (insights?.upcoming ?? []).filter((u) => {
    try {
      const d = new Date(u.dueDate);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    } catch { return false; }
  });

  const handleCategoryPress = (cat: ExpenseCategoryBreakdown) => {
    setSheetCategory({ categoryId: cat.categoryId, categoryName: cat.name, color: cat.color, icon: cat.icon });
    setSheetOpen(true);
  };

  const handleSheetMutated = () => {
    // Refresh the summary in the background so stats update after mutations
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <MonthBar
        month={month} year={year}
        onPrev={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        prevDisabled={!canDecrement(year, month)}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f282f" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="rgba(15,40,47,0.55)" />
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
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0f282f" />
          }
          ListHeaderComponent={
            <>
              {summary && (
                <ExpenseStatGrid
                  totalAmount={summary.totalAmount}
                  totalCount={summary.totalCount}
                  paidAmount={summary.paidAmount}
                  paidCount={summary.paidCount}
                  unpaidAmount={summary.unpaidAmount}
                  unpaidCount={summary.unpaidCount}
                  currency={currency}
                  fmt={fmt}
                />
              )}
              {summary && (
                <CategoryBreakdown
                  categories={summary.categoryBreakdown}
                  currency={currency}
                  fmt={fmt}
                  onCategoryPress={handleCategoryPress}
                />
              )}
              <UpcomingList payments={upcoming} currency={currency} fmt={fmt} />
            </>
          }
          renderItem={() => null}
        />
      )}

      <CategoryExpensesSheet
        visible={sheetOpen}
        category={sheetCategory}
        month={month}
        year={year}
        currency={currency}
        onClose={() => setSheetOpen(false)}
        onMutated={handleSheetMutated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f2f4f7" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scrollContent: { paddingBottom: 140 },
  errorText: { color: "#e25c5c", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },
});
