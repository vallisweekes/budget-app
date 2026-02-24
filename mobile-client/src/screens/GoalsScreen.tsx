import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { DashboardData, Settings } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export default function GoalsScreen({ navigation }: { navigation: any }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canGoBack = typeof navigation?.canGoBack === "function" ? navigation.canGoBack() : false;

  const load = useCallback(async () => {
    try {
      setError(null);
      const [dash, s] = await Promise.all([
        apiFetch<DashboardData>("/api/bff/dashboard"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setDashboard(dash);
      setSettings(s);

      const nextSelected = (Array.isArray(dash.homepageGoalIds) && dash.homepageGoalIds.length > 0
        ? dash.homepageGoalIds
        : s.homepageGoalIds ?? [])
        .filter((id) => typeof id === "string")
        .slice(0, 2);
      setSelectedIds(nextSelected);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load goals");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const goals = dashboard?.goals ?? [];
  const selectedCount = selectedIds.length;

  const dirty = useMemo(() => {
    const base = (dashboard?.homepageGoalIds ?? settings?.homepageGoalIds ?? []).slice(0, 2);
    if (base.length !== selectedIds.length) return true;
    const a = [...base].sort().join("|");
    const b = [...selectedIds].sort().join("|");
    return a !== b;
  }, [dashboard?.homepageGoalIds, settings?.homepageGoalIds, selectedIds]);

  const toggleGoal = (goalId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(goalId)) return prev.filter((id) => id !== goalId);
      if (prev.length >= 2) return prev;
      return [...prev, goalId];
    });
  };

  const save = async () => {
    if (!dashboard?.budgetPlanId) return;

    try {
      setSaving(true);
      await apiFetch<Settings>("/api/bff/settings", {
        method: "PATCH",
        body: {
          budgetPlanId: dashboard.budgetPlanId,
          homepageGoalIds: selectedIds,
        },
      });
      Alert.alert("Saved", "Dashboard goals updated.");
      if (canGoBack) navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Failed to save", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.info}>Loading goals…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={46} color={T.textDim} />
          <Text style={s.error}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}>
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.header}>
        {canGoBack ? (
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={T.text} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
        <Text style={s.title}>Goals</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={s.helperWrap}>
        <Text style={s.helper}>Choose up to 2 goals for dashboard cards.</Text>
        <Text style={s.helperCount}>{selectedCount}/2 selected</Text>
      </View>

      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const active = selectedIds.includes(item.id);
          return (
            <Pressable onPress={() => toggleGoal(item.id)} style={[s.row, active && s.rowActive]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {item.targetAmount ? `Target ${item.targetAmount}` : (item.category || item.type)}
                </Text>
              </View>
              <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={22} color={active ? T.accent : T.textMuted} />
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>No goals yet.</Text>}
      />

      <View style={s.footer}>
        <Pressable
          onPress={save}
          disabled={saving || !dirty}
          style={[s.saveBtn, (saving || !dirty) && s.disabled]}
        >
          {saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.saveTxt}>Save</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20 },
  info: { color: T.textDim, fontSize: 14, fontWeight: "600" },
  error: { color: T.red, textAlign: "center", fontSize: 14, fontWeight: "600" },
  retryBtn: { marginTop: 8, backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "800" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: T.text, fontSize: 18, fontWeight: "900" },
  helperWrap: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  helper: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  helperCount: { color: T.accent, fontSize: 12, fontWeight: "800" },

  list: { paddingHorizontal: 16, paddingBottom: 110 },
  row: {
    ...cardElevated,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  rowActive: { borderColor: T.accent },
  rowTitle: { color: T.text, fontSize: 15, fontWeight: "800" },
  rowSub: { color: T.textDim, fontSize: 12, fontWeight: "600", marginTop: 2 },
  empty: { color: T.textDim, fontStyle: "italic", paddingVertical: 12 },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
    backgroundColor: T.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  saveBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  saveTxt: { color: T.onAccent, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.55 },
});
