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
import { currencySymbol, fmt } from "@/lib/formatting";
import { useYearGuard } from "@/lib/hooks/useYearGuard";
import { T } from "@/lib/theme";
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
  const [viewMode, setViewMode] = useState<"income" | "sacrifice">("income");

  const currency = currencySymbol(settings?.currency);
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

  const openSacrificeSetup = () => {
    const budgetPlanId = data?.budgetPlanId;
    if (!budgetPlanId) return;
    const monthToOpen = year === nowYear ? nowMonthIndex : 1;
    navigation.navigate("IncomeMonth", {
      month: monthToOpen,
      year,
      budgetPlanId,
      initialMode: "sacrifice",
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.loadingText}>Loading income…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}>
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const months = data?.months ?? [];
  const nowMonthIndex = now.getMonth() + 1;
  const nowYear = now.getFullYear();

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
          <Ionicons name="chevron-back" size={20} color={year - 1 < minYear ? T.textMuted : T.text} />
        </Pressable>
        <Text style={s.yearLabel}>{year}</Text>
        <Pressable onPress={() => changeYear(1)} style={s.yearArrow} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={T.text} />
        </Pressable>
      </View>

      <View style={s.modeWrap}>
        <Pressable style={[s.modePill, viewMode === "income" && s.modePillActive]} onPress={() => setViewMode("income")}>
          <Text style={[s.modeTxt, viewMode === "income" && s.modeTxtActive]}>Income</Text>
        </Pressable>
        <Pressable
          style={[s.modePill, viewMode === "sacrifice" && s.modePillActive]}
          onPress={() => {
            setViewMode("sacrifice");
            openSacrificeSetup();
          }}
        >
          <Text style={[s.modeTxt, viewMode === "sacrifice" && s.modeTxtActive]}>Income sacrifice</Text>
        </Pressable>
      </View>

      <FlatList
        data={months}
        numColumns={2}
        keyExtractor={(item) => item.monthKey}
        contentContainerStyle={s.grid}
        columnWrapperStyle={s.gridRow}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />
        }
        renderItem={({ item }) => {
          const isActive = year === nowYear && item.monthIndex === nowMonthIndex;
          const isLocked =
            year < nowYear || (year === nowYear && item.monthIndex < nowMonthIndex);
          return (
            <IncomeMonthCard
              item={item}
              currency={currency}
              fmt={fmt}
              active={isActive}
              locked={isLocked}
              onPress={() =>
                navigation.navigate("IncomeMonth", {
                  month: item.monthIndex,
                  year,
                  budgetPlanId: data?.budgetPlanId ?? "",
                  initialMode: viewMode,
                })
              }
            />
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={48} color={T.iconMuted} />
            <Text style={s.emptyText}>No income data for {year}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: T.textDim, marginTop: 8, fontSize: 14 },

  yearBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: T.card,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  yearArrow: { padding: 8 },
  yearArrowDisabled: { opacity: 0.4 },
  yearLabel: { color: T.text, fontSize: 18, fontWeight: "900" },

  modeWrap: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    padding: 4,
  },
  modePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: T.accent,
  },
  modeTxt: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "800",
  },
  modeTxtActive: {
    color: T.onAccent,
  },

  grid: { padding: 12, paddingBottom: 140 },
  gridRow: { gap: 10, marginBottom: 10 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { color: T.textDim, fontSize: 15, fontWeight: "700" },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },
});
