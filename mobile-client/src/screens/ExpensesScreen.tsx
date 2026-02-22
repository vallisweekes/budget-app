import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { Expense } from "@/lib/apiTypes";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(val: string | null | undefined): string {
  const n = parseFloat(val ?? "0");
  return isNaN(n) ? "$0.00" : `$${Math.abs(n).toFixed(2)}`;
}

export default function ExpensesScreen() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}`);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const filtered = search.trim()
    ? expenses.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : expenses;

  const total = filtered.reduce((s, e) => s + parseFloat(e.amount ?? "0"), 0);
  const paid = filtered.filter((e) => e.paid);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Month selector */}
      <View style={styles.monthBar}>
        <Pressable onPress={() => changeMonth(-1)} style={styles.monthArrow}>
          <Ionicons name="chevron-back" size={20} color="#4f6cf7" />
        </Pressable>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
        <Pressable onPress={() => changeMonth(1)} style={styles.monthArrow}>
          <Ionicons name="chevron-forward" size={20} color="#4f6cf7" />
        </Pressable>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryVal}>{filtered.length}</Text>
          <Text style={styles.summaryLbl}>total</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryVal}>{paid.length}</Text>
          <Text style={styles.summaryLbl}>paid</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryVal}>{fmt(String(total))}</Text>
          <Text style={styles.summaryLbl}>total amount</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color="#556" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses…"
          placeholderTextColor="#4a5568"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color="#556" />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f6cf7" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="#455" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ExpenseRow expense={item} />}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4f6cf7" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#2a3a55" />
              <Text style={styles.emptyText}>
                {search ? "No matching expenses" : "No expenses this month"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const categoryColor = expense.category?.color ?? "#4f6cf7";
  return (
    <View style={styles.expenseRow}>
      <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
      <View style={styles.expenseInfo}>
        <Text style={styles.expenseName} numberOfLines={1}>{expense.name}</Text>
        {expense.category && (
          <Text style={styles.expenseCat} numberOfLines={1}>{expense.category.name}</Text>
        )}
      </View>
      <View style={styles.expenseRight}>
        <Text style={styles.expenseAmount}>{fmt(expense.amount)}</Text>
        <View style={[styles.badge, expense.paid ? styles.badgePaid : styles.badgeUnpaid]}>
          <Text style={styles.badgeText}>{expense.paid ? "paid" : "due"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#070e1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },

  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  monthArrow: { padding: 8 },
  monthLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },

  summaryBar: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#111d30",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  summaryVal: { color: "#fff", fontWeight: "700", fontSize: 15 },
  summaryLbl: { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111d30",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },

  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { color: "rgba(255,255,255,0.3)", fontSize: 15 },

  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    gap: 12,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  expenseInfo: { flex: 1, minWidth: 0 },
  expenseName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  expenseCat: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 },
  expenseRight: { alignItems: "flex-end", gap: 5, flexShrink: 0 },
  expenseAmount: { color: "#fff", fontSize: 14, fontWeight: "700" },

  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgePaid: { backgroundColor: "rgba(62,201,126,0.15)" },
  badgeUnpaid: { backgroundColor: "rgba(244,169,66,0.15)" },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff", textTransform: "uppercase" },

  errorText: { color: "#e25c5c", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: "#4f6cf7", borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: "#fff", fontWeight: "700" },
});
