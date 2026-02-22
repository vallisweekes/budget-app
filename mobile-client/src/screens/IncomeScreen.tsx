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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { apiFetch } from "@/lib/api";
import type { IncomeSummaryData, Settings } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { useYearGuard } from "@/lib/hooks/useYearGuard";
import IncomeMonthCard from "@/components/Income/IncomeMonthCard";
import type { IncomeStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<IncomeStackParamList, "IncomeGrid">;

export default function IncomeScreen() {
  const navigation = useNavigation<Nav>();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<IncomeSummaryData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = settings?.currency ?? "£";
  const { minYear } = useYearGuard(settings);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [incData, s] = await Promise.all([
        apiFetch<IncomeSummaryData>(`/api/bff/income-summary?year=${year}`),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setData(incData);
      setSettings(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load income");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useFocusEffect(
    useCallback(() => { if (!loading) load(); }, [load, loading]),
  );

  const changeYear = (delta: number) => {
    if (delta < 0 && year - 1 < minYear) return;
    setYear((y) => y + delta);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#02eff0" />
          <Text style={s.loadingText}>Loading income…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="#455" />
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}>
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const months = data?.months ?? [];
  const grandTotal = data?.grandTotal ?? 0;
  const monthsWithIncome = data?.monthsWithIncome ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      {/* Year selector */}
      <View style={s.yearBar}>
        <Pressable
          onPress={() => changeYear(-1)}
          disabled={year - 1 < minYear}
          style={[s.yearArrow, year - 1 < minYear && s.yearArrowDisabled]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={year - 1 < minYear ? "rgba(2,239,240,0.3)" : "#02eff0"} />
        </Pressable>
        <Text style={s.yearLabel}>{year}</Text>
        <Pressable onPress={() => changeYear(1)} style={s.yearArrow} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color="#02eff0" />
        </Pressable>
      </View>

      {/* Annual summary */}
      <View style={s.summaryBar}>
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{monthsWithIncome}</Text>
          <Text style={s.summaryLbl}>months</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{fmt(grandTotal, currency)}</Text>
          <Text style={s.summaryLbl}>annual total</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>
            {monthsWithIncome > 0 ? fmt(grandTotal / monthsWithIncome, currency) : fmt(0, currency)}
          </Text>
          <Text style={s.summaryLbl}>avg / month</Text>
        </View>
      </View>

      <FlatList
        data={months}
        numColumns={2}
        keyExtractor={(item) => item.monthKey}
        contentContainerStyle={s.grid}
        columnWrapperStyle={s.gridRow}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#02eff0" />
        }
        renderItem={({ item }) => (
          <IncomeMonthCard
            item={item}
            currency={currency}
            fmt={fmt}
            onPress={() =>
              navigation.navigate("IncomeMonth", {
                month: item.monthIndex,
                year,
                budgetPlanId: data?.budgetPlanId ?? "",
              })
            }
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={48} color="#1a3d3f" />
            <Text style={s.emptyText}>No income data for {year}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f282f" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "rgba(255,255,255,0.35)", marginTop: 8, fontSize: 14 },

  yearBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  yearArrow: { padding: 8 },
  yearArrowDisabled: { opacity: 0.4 },
  yearLabel: { color: "#fff", fontSize: 18, fontWeight: "700" },

  summaryBar: {
    flexDirection: "row", paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: "#0a1e23", borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  summaryVal: { color: "#fff", fontWeight: "700", fontSize: 14 },
  summaryLbl: { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 },

  grid: { padding: 12, paddingBottom: 140 },
  gridRow: { gap: 10, marginBottom: 10 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { color: "rgba(255,255,255,0.3)", fontSize: 15 },
  errorText: { color: "#e25c5c", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: "#02eff0", borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: "#061b1c", fontWeight: "700" },
});
