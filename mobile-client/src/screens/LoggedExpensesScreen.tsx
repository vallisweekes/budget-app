import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as LucideIcons from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { apiFetch } from "@/lib/api";
import type { Expense } from "@/lib/apiTypes";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { resolveCategoryColor, withOpacity } from "@/lib/categoryColors";
import { fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { buildPayPeriodFromMonthAnchor, formatPayPeriodLabel, normalizePayFrequency } from "@/lib/payPeriods";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";
import type { ExpensesStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<ExpensesStackParamList, "LoggedExpenses">;

function CategoryIcon({ name, color }: { name: string | null | undefined; color: string }) {
  const Icon = name
    ? ((LucideIcons as Record<string, unknown>)[name] as
        | React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
        | undefined)
    : undefined;

  return (
    <View style={[styles.iconWrap, { backgroundColor: withOpacity(color, 0.13) }]}>
      {Icon ? <Icon size={18} color={color} strokeWidth={2} /> : <View style={[styles.iconDot, { backgroundColor: color }]} />}
    </View>
  );
}

export default function LoggedExpensesScreen({ route, navigation }: Props) {
  const topHeaderOffset = useTopHeaderOffset();
  const { categoryId, categoryName, color, month, year, budgetPlanId, currency } = route.params;
  const { settings } = useBootstrapData();
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      setError(null);
      if (force) setRefreshing(true);
      else setLoading(true);
      const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const all = await apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}&scope=pay_period${qp}`);
      const allExpenses = Array.isArray(all) ? all : [];
      const next = allExpenses.filter((entry) => (
        (categoryId ? entry.categoryId === categoryId : true)
        && entry.isExtraLoggedExpense
        && entry.paymentSource !== "income"
      ));
      setItems(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logged expenses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, categoryId, month, year]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load])
  );

  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.amount), 0), [items]);
  const payDate = Number.isFinite(settings?.payDate as number) && (settings?.payDate as number) >= 1
    ? Math.floor(settings?.payDate as number)
    : 27;
  const payFrequency = normalizePayFrequency(settings?.payFrequency);
  const period = buildPayPeriodFromMonthAnchor({ year, month, payDate, payFrequency });
  const periodLabel = formatPayPeriodLabel(period.start, period.end);
  const screenKicker = categoryName ?? "All categories";

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void load(true); }}
            tintColor={T.textDim}
          />
        }
        ListHeaderComponent={
          <>
            <View style={[styles.purpleHero, { paddingTop: topHeaderOffset + 22 }]}>
              <Text style={styles.purpleHeroLabel}>{periodLabel}</Text>
              <Text style={styles.purpleHeroAmount}>{fmt(total, currency)}</Text>
              <Text style={styles.purpleHeroMeta}>{items.length} logged expense{items.length === 1 ? "" : "s"}</Text>
            </View>

            <View style={styles.sectionHeadingWrap}>
              <Text style={styles.sectionHeading}>{screenKicker}</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate("ExpenseDetail", {
              expenseId: item.id,
              expenseName: item.name,
              categoryId: categoryId ?? item.categoryId ?? "__none__",
              categoryName: categoryName ?? item.category?.name ?? "Uncategorised",
              color: color ?? item.category?.color ?? null,
              month,
              year,
              budgetPlanId,
              currency,
            })}
          >
            <View style={styles.topRow}>
              <View style={styles.left}>
                <CategoryIcon
                  name={item.category?.icon}
                  color={resolveCategoryColor(color ?? item.category?.color ?? null)}
                />
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.rowAmount}>{fmt(Number(item.amount), currency)}</Text>
                <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
              </View>
            </View>

            <Text style={styles.rowMeta}>
              {(item.category?.name ?? categoryName ?? "Uncategorised")} · {String(item.paymentSource ?? "").replace("_", " ")}
            </Text>

            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: "100%",
                    backgroundColor: resolveCategoryColor(color ?? item.category?.color ?? null),
                  },
                ]}
              />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={T.accent} />
              <Text style={styles.empty}>Loading…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={() => { void load(true); }}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.empty}>No logged expenses in this period.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 28 },
  purpleHero: {
    backgroundColor: "#2a0a9e",
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: "center",
  },
  purpleHeroLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  purpleHeroAmount: {
    color: "#ffffff",
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 2,
  },
  purpleHeroMeta: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  sectionHeadingWrap: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeading: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    ...cardElevated,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 6,
  },
  cardPressed: { opacity: 0.75 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconDot: { width: 10, height: 10, borderRadius: 5 },
  rowName: {
    color: T.text,
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },
  rowMeta: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
    paddingLeft: 46,
  },
  rowAmount: {
    color: T.text,
    fontSize: 15,
    fontWeight: "900",
  },
  track: {
    height: 6,
    backgroundColor: T.border,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  fill: { height: "100%", borderRadius: 3 },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  empty: {
    color: T.textDim,
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    color: T.red,
    fontSize: 13,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    color: T.onAccent,
    fontSize: 13,
    fontWeight: "800",
  },
});
