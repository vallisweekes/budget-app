import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polyline } from "react-native-svg";

import type { DashboardData } from "@/lib/apiTypes";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { resolveGoalCurrentAmount } from "@/lib/helpers/settings";
import { useTopHeaderOffset } from "@/hooks";
import { T } from "@/lib/theme";

import { styles } from "./style";

export default function GoalsProjectionScreen({ navigation }: { navigation: any }) {
  const topHeaderOffset = useTopHeaderOffset();
  const { dashboard: bootstrapDashboard, settings, ensureLoaded, refresh: refreshBootstrap } = useBootstrapData();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options?: { force?: boolean }) => {
    try {
      setError(null);
      const next = options?.force ? await refreshBootstrap({ force: true }) : await ensureLoaded();
      const dash = next.dashboard ?? bootstrapDashboard;
      if (!dash) throw new Error("Failed to load projection");
      setDashboard(dash);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load projection");
    } finally {
      setLoading(false);
    }
  }, [bootstrapDashboard, ensureLoaded, refreshBootstrap]);

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

        const current = resolveGoalCurrentAmount(goal.category, goal.currentAmount, settings);
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
			<SafeAreaView style={[styles.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={styles.stateText}>Loading projection…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={[styles.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load({ force: true })} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
		<SafeAreaView style={[styles.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <Text style={styles.title}>Goals projection</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {projection ? (
          <View style={styles.chartCard}>
            <View style={styles.legendRow}>
              {projection.lines.map((line) => (
                <View key={line.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: line.color }]} />
                  <Text style={styles.legendTxt}>{line.label}</Text>
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

            <View style={styles.axisRow}>
              <Text style={styles.axisTxt}>Now</Text>
              <Text style={styles.axisTxt}>12 months</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No projection data yet</Text>
            <Text style={styles.emptyDetail}>Set up savings, emergency, or investment goals with amounts and contributions to see the chart.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
