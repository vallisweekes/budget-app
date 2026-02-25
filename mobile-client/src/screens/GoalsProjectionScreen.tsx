import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polyline } from "react-native-svg";

import { apiFetch } from "@/lib/api";
import type { DashboardData } from "@/lib/apiTypes";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export default function GoalsProjectionScreen({ navigation }: { navigation: any }) {
  const topHeaderOffset = useTopHeaderOffset();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const dash = await apiFetch<DashboardData>("/api/bff/dashboard");
      setDashboard(dash);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load projection");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const projection = useMemo(() => {
    const goals = dashboard?.goals ?? [];

    const classifyGoal = (goal: (typeof goals)[number]): "savings" | "emergency" | "investments" | null => {
      const c = String(goal.category ?? "").toLowerCase();
      const t = String(goal.title ?? "").toLowerCase();
      if (c.includes("saving") || t.includes("saving")) return "savings";
      if (c.includes("emergency") || t.includes("emergency")) return "emergency";
      if (c.includes("invest") || t.includes("invest")) return "investments";
      return null;
    };

    const monthlyByType = {
      savings: Math.max(0, dashboard?.plannedSavingsContribution ?? 0),
      emergency: Math.max(0, dashboard?.plannedEmergencyContribution ?? 0),
      investments: Math.max(0, dashboard?.plannedInvestments ?? 0),
    } as const;

    const seriesConfig = [
      { type: "savings" as const, color: T.accent, label: "Savings" },
      { type: "emergency" as const, color: T.green, label: "Emergency" },
      { type: "investments" as const, color: T.orange, label: "Investments" },
    ];

    const goalsByType = new Map<"savings" | "emergency" | "investments", (typeof goals)[number]>();
    for (const goal of goals) {
      const kind = classifyGoal(goal);
      if (!kind || goalsByType.has(kind)) continue;
      goalsByType.set(kind, goal);
    }

    const months = 12;
    const lines = seriesConfig
      .map((cfg) => {
        const goal = goalsByType.get(cfg.type);
        if (!goal) return null;

        const current = Math.max(0, goal.currentAmount ?? 0);
        const target = Math.max(0, goal.targetAmount ?? 0);
        const monthly = monthlyByType[cfg.type];

        if (current <= 0 && target <= 0 && monthly <= 0) return null;

        const points = Array.from({ length: months + 1 }, (_, i) => {
          const projected = current + monthly * i;
          return target > 0 ? Math.min(target, projected) : projected;
        });

        return {
          label: cfg.label,
          color: cfg.color,
          points,
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));

    if (lines.length === 0) return null;

    const maxY = Math.max(1, ...lines.flatMap((line) => line.points));
    return { lines, maxY, months };
  }, [dashboard]);

  if (loading) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.stateText}>Loading projection…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
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

  return (
		<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <Text style={s.title}>Goals projection</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {projection ? (
          <View style={s.chartCard}>
            <View style={s.legendRow}>
              {projection.lines.map((line) => (
                <View key={line.label} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: line.color }]} />
                  <Text style={s.legendTxt}>{line.label}</Text>
                </View>
              ))}
            </View>

            <Svg width="100%" height={180} viewBox="0 0 320 180" preserveAspectRatio="none">
              {projection.lines.map((line) => {
                const poly = line.points
                  .map((p, i) => {
                    const x = (i / projection.months) * 320;
                    const y = 160 - (p / projection.maxY) * 130;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(" ");

                return (
                  <Polyline
                    key={line.label}
                    points={poly}
                    fill="none"
                    stroke={line.color}
                    strokeWidth={2.6}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                );
              })}
            </Svg>

            <View style={s.axisRow}>
              <Text style={s.axisTxt}>Now</Text>
              <Text style={s.axisTxt}>12 months</Text>
            </View>
          </View>
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No projection data yet</Text>
            <Text style={s.emptyDetail}>Set up savings, emergency, or investment goals with amounts and contributions to see the chart.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, paddingHorizontal: 24 },
  stateText: { color: T.textDim, fontSize: 14, fontWeight: "700" },
  errorText: { color: T.red, fontSize: 14, textAlign: "center" },
  retryBtn: { marginTop: 10, backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "800" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: T.text, fontSize: 18, fontWeight: "900" },

  scroll: { padding: 16, paddingBottom: 40 },
  chartCard: {
    ...cardElevated,
    padding: 14,
  },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 999 },
  legendTxt: { color: T.textDim, fontSize: 11, fontWeight: "700" },
  axisRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  axisTxt: { color: T.textMuted, fontSize: 11, fontWeight: "700" },

  emptyCard: {
    ...cardElevated,
    padding: 16,
    gap: 6,
  },
  emptyTitle: { color: T.text, fontSize: 15, fontWeight: "900" },
  emptyDetail: { color: T.textDim, fontSize: 13, fontWeight: "600", lineHeight: 18 },
});
