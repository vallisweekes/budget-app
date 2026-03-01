import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Image,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { apiFetch } from "@/lib/api";
import type { Expense } from "@/lib/apiTypes";
import { resolveCategoryColor, withOpacity } from "@/lib/categoryColors";
import { fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { T } from "@/lib/theme";
import type { ExpensesStackParamList } from "@/navigation/types";
import AddExpenseSheet from "@/components/Expenses/AddExpenseSheet";
import type { ExpenseCategoryBreakdown } from "@/lib/apiTypes";

type Props = NativeStackScreenProps<ExpensesStackParamList, "CategoryExpenses">;

function dueDaysColor(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return T.red;
  if (days <= 3) return T.orange;
  if (days <= 7) return T.orange;
  return T.green;
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function CategoryExpensesScreen({ route, navigation }: Props) {
  const topHeaderOffset = useTopHeaderOffset();
  const {
    categoryId,
    categoryName,
    color,
    icon,
    month: routeMonth,
    year: routeYear,
    budgetPlanId,
    currency,
  } = route.params;
  const categoryColor = useMemo(() => resolveCategoryColor(color), [color]);

  const [month, setMonth] = useState(routeMonth);
  const [year, setYear] = useState(routeYear);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(routeYear);
  const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const monthName = useCallback((value: number) => {
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
    return names[Math.max(1, Math.min(12, value)) - 1] ?? "";
  }, []);

  const openMonthPicker = useCallback(() => {
    setPickerYear(year);
    setMonthPickerOpen(true);
  }, [year]);

  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const categoriesForAddSheet = useMemo<ExpenseCategoryBreakdown[]>(
    () => [
      {
        categoryId,
        name: categoryName,
        color,
        icon,
        total: 0,
        paidTotal: 0,
        paidCount: 0,
        totalCount: 0,
      },
    ],
    [categoryId, categoryName, color, icon]
  );

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (routeMonth !== month) {
      setMonth(routeMonth);
    }
    if (routeYear !== year) {
      setYear(routeYear);
      setPickerYear(routeYear);
    }
  }, [month, routeMonth, routeYear, year]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const all = await apiFetch<Expense[]>(
        `/api/bff/expenses?month=${month}&year=${year}&refreshLogos=1${qp}`
      );
      setExpenses(Array.isArray(all) ? all.filter((e) => e.categoryId === categoryId) : []);
      setLogoFailed({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
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

  useEffect(() => {
    setLoading(true);
    setExpenses([]);
    void load();
  }, [load]);

  const plannedTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const paidTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.paidAmount), 0), [expenses]);
  const remainingTotal = useMemo(() => Math.max(plannedTotal - paidTotal, 0), [plannedTotal, paidTotal]);

  const paidPct = useMemo(() => {
    if (plannedTotal <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((paidTotal / plannedTotal) * 100)));
  }, [paidTotal, plannedTotal]);

  const remainingPct = useMemo(() => {
    if (plannedTotal <= 0) return 0;
    return Math.max(0, Math.min(100, 100 - paidPct));
  }, [paidPct, plannedTotal]);

  const latestPaymentAt = useMemo(() => {
    let best: string | null = null;
    for (const e of expenses) {
      if (!e.lastPaymentAt) continue;
      if (!best) {
        best = e.lastPaymentAt;
        continue;
      }
      if (new Date(e.lastPaymentAt).getTime() > new Date(best).getTime()) {
        best = e.lastPaymentAt;
      }
    }
    return best;
  }, [expenses]);

  const updatedLabel = useMemo(() => {
    if (!latestPaymentAt) return "Updated: —";
    return `Updated: ${new Date(latestPaymentAt).toLocaleDateString("en-GB")}`;
  }, [latestPaymentAt]);

  const renderItem = useCallback(
    ({ item }: { item: Expense }) => {
      const amount = Number(item.amount);
      const paidAmount = Number(item.paidAmount);
      const remainingAmount = Math.max(amount - paidAmount, 0);
      const ratio = amount > 0 ? Math.min(paidAmount / amount, 1) : item.paid ? 1 : 0;
      const dueColor = item.dueDate ? dueDaysColor(item.dueDate) : null;

      const logoUri = resolveLogoUri(item.logoUrl);
      const showLogo = Boolean(logoUri) && !logoFailed[item.id];

      const isPartial = !item.paid && paidAmount > 0;
      const statusLabel = item.paid ? "Paid" : isPartial ? "Partial" : "Unpaid";
      const statusColor = item.paid ? T.green : isPartial ? T.orange : T.red;

      return (
        <Pressable
          style={rowStyles.card}
          onPress={() =>
            navigation.navigate("ExpenseDetail", {
              expenseId: item.id,
              expenseName: item.name,
              categoryId,
              categoryName,
              color,
              month,
              year,
              budgetPlanId,
              currency,
            })
          }
        >
          <View style={rowStyles.row1}>
            <View style={rowStyles.logoWrap}>
              {showLogo ? (
                <Image
                  source={{ uri: logoUri! }}
                  style={rowStyles.logoImg}
                  onError={() => setLogoFailed((p) => ({ ...p, [item.id]: true }))}
                />
              ) : (
                <Text style={rowStyles.logoFallback}>
                  {String(item.name ?? "?").trim()[0]?.toUpperCase() ?? "?"}
                </Text>
              )}
            </View>

            <View style={rowStyles.nameCol}>
              <Text style={rowStyles.name} numberOfLines={1}>
                {item.name}
              </Text>

              <View style={rowStyles.badgeRow}>
                {item.dueDate ? (
                  <View
                    style={[
                      rowStyles.badge,
                      {
                        borderColor: dueColor ?? T.border,
                        backgroundColor: dueColor ? withOpacity(dueColor, 0.14) : "transparent",
                      },
                    ]}
                  >
                    <Text style={[rowStyles.badgeTxt, { color: dueColor ?? T.textDim }]}>
                      Due {formatDueDate(item.dueDate)}
                    </Text>
                  </View>
                ) : null}

                {item.isAllocation ? (
                  <View
                    style={[
                      rowStyles.badge,
                      { borderColor: T.border, backgroundColor: withOpacity(T.accent, 0.08) },
                    ]}
                  >
                    <Text style={[rowStyles.badgeTxt, { color: T.textDim }]}>Allocation</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={rowStyles.rightCol}>
              <View
                style={[
                  rowStyles.badge,
                  {
                    borderColor: statusColor,
                    backgroundColor: withOpacity(statusColor, 0.14),
                  },
                ]}
              >
                <Text style={[rowStyles.badgeTxt, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.iconMuted} />
            </View>
          </View>

          <View style={rowStyles.row2}>
            <Text style={rowStyles.amount}>{fmt(amount, currency)}</Text>
            <View style={rowStyles.snapshotCol}>
              <View style={rowStyles.snapshotRow}>
                <Text style={rowStyles.snapshotTxt}>Paid: {fmt(paidAmount, currency)}</Text>
                <Text style={[rowStyles.snapshotTxt, rowStyles.snapshotRemaining]}>
                  Remaining: {fmt(remainingAmount, currency)}
                </Text>
              </View>
            </View>
          </View>

          <View style={rowStyles.progressBg}>
            <View
              style={[
                rowStyles.progressFill,
                { width: `${Math.round(ratio * 100)}%`, backgroundColor: categoryColor },
              ]}
            />
          </View>
        </Pressable>
      );
    },
    [
      budgetPlanId,
      categoryColor,
      categoryId,
      categoryName,
      color,
      currency,
      logoFailed,
      month,
      navigation,
      year,
    ]
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <FlatList
        data={expenses}
        keyExtractor={(e) => e.id}
        renderItem={renderItem}
        contentContainerStyle={rowStyles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={T.textDim}
          />
        }
        ListHeaderComponent={
          <View style={[styles.hero, { paddingTop: topHeaderOffset + 14 }]}>
            <Pressable onPress={openMonthPicker} style={styles.heroMonthBtn} hitSlop={12}>
              <Text style={styles.heroMonthText}>{monthName(month)} {year}</Text>
              <Ionicons name="chevron-down" size={14} color={withOpacity(T.onAccent, 0.8)} />
            </Pressable>
            <Text style={styles.heroAmount}>{fmt(plannedTotal, currency)}</Text>
            <View style={styles.heroPctPill}>
              <Text style={styles.heroPctText}>{paidPct}%</Text>
            </View>
            <Text style={styles.heroUpdated}>{updatedLabel}</Text>

            <View style={styles.heroCards}>
              <View style={styles.heroCard}>
                <Text style={styles.heroCardLbl}>Paid</Text>
                <Text style={[styles.heroCardVal, { color: T.green }]}>{fmt(paidTotal, currency)}</Text>
                <Text style={[styles.heroCardPct, { color: withOpacity(T.green, 0.92) }]}>{paidPct}%</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={styles.heroCardLbl}>Remaining</Text>
                <Text style={[styles.heroCardVal, { color: T.onAccent }]}>{fmt(remainingTotal, currency)}</Text>
                <Text style={styles.heroCardPct}>{remainingPct}%</Text>
              </View>
            </View>

            <Pressable style={styles.heroAddBtn} onPress={() => setAddSheetOpen(true)}>
              <Ionicons name="add" size={18} color={T.onAccent} />
              <Text style={styles.heroAddTxt}>Expense</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={[styles.center, { paddingTop: 20 }]}>
              <ActivityIndicator color={T.accent} />
              <Text style={styles.emptyTxt}>Loading…</Text>
            </View>
          ) : error ? (
            <View style={[styles.center, { paddingTop: 20 }]}>
              <Text style={styles.errTxt}>{error}</Text>
              <Pressable
                style={styles.retryBtn}
                onPress={() => {
                  setRefreshing(true);
                  void load();
                }}
              >
                <Text style={styles.retryTxt}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyTxt}>No expenses yet.</Text>
            </View>
          )
        }
      />

      <Modal
        visible={monthPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setMonthPickerOpen(false)} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />

            <View style={styles.pickerYearRow}>
              <Pressable
                onPress={() => setPickerYear((value) => value - 1)}
                hitSlop={12}
                style={styles.pickerYearBtn}
              >
                <Ionicons name="chevron-back" size={22} color={T.text} />
              </Pressable>
              <Text style={styles.pickerYearText}>{pickerYear}</Text>
              <Pressable
                onPress={() => setPickerYear((value) => value + 1)}
                hitSlop={12}
                style={styles.pickerYearBtn}
              >
                <Ionicons name="chevron-forward" size={22} color={T.text} />
              </Pressable>
            </View>

            <View style={styles.pickerGrid}>
              {shortMonths.map((label, idx) => {
                const selectedMonth = idx + 1;
                const isSelected = selectedMonth === month && pickerYear === year;
                return (
                  <Pressable
                    key={selectedMonth}
                    onPress={() => {
                      setMonth(selectedMonth);
                      setYear(pickerYear);
                      navigation.setParams({ month: selectedMonth, year: pickerYear });
                      setMonthPickerOpen(false);
                    }}
                    style={[styles.pickerCell, isSelected && styles.pickerCellSelected]}
                  >
                    <Text style={[styles.pickerCellText, isSelected && styles.pickerCellSelectedText]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <AddExpenseSheet
        visible={addSheetOpen}
        month={month}
        year={year}
        budgetPlanId={budgetPlanId}
        initialCategoryId={categoryId}
        headerTitle={categoryName}
        currency={currency}
        categories={categoriesForAddSheet}
        onAdded={() => {
          setAddSheetOpen(false);
          void load();
        }}
        onClose={() => setAddSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  hero: {
    backgroundColor: "#2a0a9e",
    paddingHorizontal: 20,
    paddingBottom: 22,
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 10,
  },
  heroMonthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  heroMonthText: {
    color: withOpacity(T.onAccent, 0.8),
    fontSize: 13,
    fontWeight: "900",
  },
  heroPctPill: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withOpacity(T.green, 0.35),
    backgroundColor: withOpacity(T.green, 0.14),
  },
  heroPctText: { color: T.green, fontSize: 12, fontWeight: "900" },
  heroAmount: {
    color: T.onAccent,
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1,
    marginBottom: 4,
  },
  heroUpdated: { color: withOpacity(T.onAccent, 0.72), fontSize: 12, fontWeight: "700", marginBottom: 12 },
  heroCards: { flexDirection: "row", gap: 10, justifyContent: "center" },
  heroCard: {
    width: 140,
    height: 80,
    backgroundColor: withOpacity(T.onAccent, 0.12),
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCardLbl: { color: withOpacity(T.onAccent, 0.65), fontSize: 11, fontWeight: "700", marginBottom: 5 },
  heroCardVal: { fontSize: 16, fontWeight: "900" },
  heroCardPct: { marginTop: 4, color: withOpacity(T.onAccent, 0.75), fontSize: 12, fontWeight: "900" },
  heroAddBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: T.accent,
  },
  heroAddTxt: { color: T.onAccent, fontWeight: "900", fontSize: 13 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  errTxt: { color: T.red, fontSize: 13, textAlign: "center" },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt: { color: T.onAccent, fontWeight: "700", fontSize: 13 },
  emptyTxt: { color: T.textDim, fontSize: 14, fontWeight: "600" },

  pickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: T.card,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: T.border,
  },
  pickerHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 99,
    backgroundColor: T.border,
    marginBottom: 12,
  },
  pickerYearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 18,
  },
  pickerYearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  pickerYearText: {
    color: T.text,
    fontSize: 18,
    fontWeight: "900",
    minWidth: 70,
    textAlign: "center",
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  pickerCell: {
    width: "30%",
    minWidth: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    paddingVertical: 10,
    alignItems: "center",
  },
  pickerCellSelected: {
    borderColor: T.accent,
    backgroundColor: T.accentDim,
  },
  pickerCellText: {
    color: T.text,
    fontWeight: "800",
  },
  pickerCellSelectedText: {
    color: T.text,
  },
});

const rowStyles = StyleSheet.create({
  list: { paddingTop: 0, paddingBottom: 32 },
  card: {
    backgroundColor: T.cardAlt,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    padding: 14,
    marginBottom: 10,
    marginHorizontal: 14,
  },
  row1: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%", borderRadius: 999 },
  logoFallback: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  nameCol: { flex: 1, minWidth: 0 },
  name: { color: T.text, fontSize: 14, fontWeight: "800", marginBottom: 4 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeTxt: { fontSize: 11, fontWeight: "600" },
  rightCol: { alignItems: "flex-end", gap: 6, paddingLeft: 8 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  statusTagTxt: { fontSize: 12, fontWeight: "800" },
  row2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 6,
  },
  amount: { color: T.text, fontSize: 15, fontWeight: "900" },
  snapshotCol: { alignItems: "flex-end" },
  snapshotRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10 },
  snapshotTxt: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  snapshotRemaining: { color: T.orange },
  progressBg: { height: 7, borderRadius: 4, backgroundColor: T.border, overflow: "hidden" },
  progressFill: { height: 7, borderRadius: 4 },
});
