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
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";

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
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { useYearGuard } from "@/lib/hooks/useYearGuard";
import { T } from "@/lib/theme";
import type { ExpensesStackParamList } from "@/navigation/types";
import CategoryBreakdown from "@/components/Expenses/CategoryBreakdown";
import AddExpenseSheet from "@/components/Expenses/AddExpenseSheet";

/* ════════════════════════════════════════════════════════════════
 * Screen
 * ════════════════════════════════════════════════════════════════ */

type Props = NativeStackScreenProps<ExpensesStackParamList, "ExpensesList">;
type ScreenRoute = RouteProp<ExpensesStackParamList, "ExpensesList">;

export default function ExpensesScreen({ navigation }: Props) {
  const route = useRoute<ScreenRoute>();
  const topHeaderOffset = useTopHeaderOffset();
  const now = new Date();
  const initialMonth = Number(route.params?.month);
  const initialYear = Number(route.params?.year);
  const [month, setMonth] = useState(Number.isFinite(initialMonth) && initialMonth >= 1 && initialMonth <= 12 ? initialMonth : now.getMonth() + 1);
  const [year, setYear] = useState(Number.isFinite(initialYear) ? initialYear : now.getFullYear());

  const [plans, setPlans] = useState<BudgetPlanListItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [expenseMonths, setExpenseMonths] = useState<ExpenseMonthsResponse["months"]>([]);

  const [summary, setSummary]   = useState<ExpenseSummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<ExpenseSummary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [addSheetOpen, setAddSheetOpen] = useState(false);

  // Month picker modal
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const openMonthPicker = () => { setPickerYear(year); setMonthPickerOpen(true); };

  const currency = currencySymbol(settings?.currency);
  const { canDecrement } = useYearGuard(settings);

  useEffect(() => {
    const routeMonth = Number(route.params?.month);
    const routeYear = Number(route.params?.year);
    if (Number.isFinite(routeMonth) && routeMonth >= 1 && routeMonth <= 12 && routeMonth !== month) {
      setMonth(routeMonth);
    }
    if (Number.isFinite(routeYear) && routeYear !== year) {
      setYear(routeYear);
    }
  }, [month, route.params?.month, route.params?.year, year]);

  useEffect(() => {
    const prevDisabled = !canDecrement(year, month);
    const paramsMonth = Number(route.params?.month);
    const paramsYear = Number(route.params?.year);
    const paramsPrevDisabled = typeof route.params?.prevDisabled === "boolean" ? route.params.prevDisabled : undefined;

    const monthChanged = !(Number.isFinite(paramsMonth) && paramsMonth === month);
    const yearChanged = !(Number.isFinite(paramsYear) && paramsYear === year);
    const disabledChanged = paramsPrevDisabled !== prevDisabled;

    if (!monthChanged && !yearChanged && !disabledChanged) return;

    navigation.setParams({
      month,
      year,
      prevDisabled,
    });
  }, [canDecrement, month, navigation, route.params?.month, route.params?.prevDisabled, route.params?.year, year]);

  const personalPlanId = plans.find((p) => p.kind === "personal")?.id ?? null;
  const activePlanId = selectedPlanId ?? personalPlanId;
  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;
  const isPersonalPlan = !activePlan || activePlan.kind === "personal";
  const isAdditionalPlan = !isPersonalPlan && plans.length > 1;

  const planTotalAmount = expenseMonths.reduce((sum, m) => sum + (m.totalAmount ?? 0), 0);
  const planTotalCount = expenseMonths.reduce((sum, m) => sum + (m.totalCount ?? 0), 0);

  const prevIsPersonalPlanRef = useRef<boolean>(true);

  // Plan tabs: keep selected pill centered when horizontally scrollable.
  const planScrollRef = useRef<ScrollView>(null);
  const planViewportWidthRef = useRef(0);
  const planItemLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});

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

  const scrollPlanIntoView = useCallback(() => {
    const selectedId = (activePlanId ?? personalPlanId) ?? null;
    if (!selectedId) return;
    const viewportWidth = planViewportWidthRef.current;
    if (!viewportWidth) return;
    const layout = planItemLayoutsRef.current[selectedId];
    if (!layout) return;
    const targetX = Math.max(0, layout.x + layout.width / 2 - viewportWidth / 2);
    planScrollRef.current?.scrollTo({ x: targetX, animated: true });
  }, [activePlanId, personalPlanId]);

  useEffect(() => {
    if (plans.length <= 1) return;
    requestAnimationFrame(scrollPlanIntoView);
  }, [plans.length, activePlanId, personalPlanId, scrollPlanIntoView]);

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

      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      const [sumData, prevData, s, bp] = await Promise.all([
        apiFetch<ExpenseSummary>(`/api/bff/expenses/summary?month=${month}&year=${year}${planQp}`),
        apiFetch<ExpenseSummary>(`/api/bff/expenses/summary?month=${prevMonth}&year=${prevYear}${planQp}`),
        apiFetch<Settings>("/api/bff/settings"),
        apiFetch<BudgetPlansResponse>("/api/bff/budget-plans"),
      ]);
      setSummary(sumData);
      setPreviousSummary(prevData);
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

  const showTopAddExpenseCta = !loading && !error && (summary?.totalCount ?? 0) === 0;

  const showPlanTotalFallback =
    isAdditionalPlan &&
    (summary?.totalCount ?? 0) === 0 &&
    expenseMonths.length > 0 &&
    planTotalAmount > 0;

  return (
		<SafeAreaView style={styles.safe} edges={[]}>
      {loading ? (
        <View style={[styles.center, { paddingTop: topHeaderOffset }]}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : error ? (
        <View style={[styles.center, { paddingTop: topHeaderOffset }]}>
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
              {/* ── Purple hero banner ── */}
              <View style={[styles.purpleHero, { paddingTop: topHeaderOffset + 22 }]}>
                <Pressable onPress={openMonthPicker} style={styles.purpleHeroLabelBtn} hitSlop={12}>
                  <Text style={styles.purpleHeroLabel}>
                    {monthName(month)} {year}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.72)" />
                </Pressable>
                {summary ? (
                  <>
                    <Text style={styles.purpleHeroAmount}>
                      {fmt(showPlanTotalFallback ? planTotalAmount : (summary.totalAmount ?? 0), currency)}
                    </Text>
                    <Text style={styles.purpleHeroMeta}>
                      {showPlanTotalFallback
                        ? `${planTotalCount} bill${planTotalCount === 1 ? "" : "s"}`
                        : `${summary.totalCount ?? 0} bill${(summary.totalCount ?? 0) === 1 ? "" : "s"}`}
                    </Text>
                    {(() => {
                      if (showPlanTotalFallback) return null;
                      const currentTotal = summary.totalAmount ?? 0;
                      const prevTotal = previousSummary?.totalAmount ?? 0;
                      if (prevTotal <= 0) return null;
                      const changePct = ((currentTotal - prevTotal) / prevTotal) * 100;
                      const up = changePct >= 0;
                      const pctLabel = `${up ? "↗" : "↘"} ${Math.abs(changePct).toFixed(1)}%`;
                      return (
                        <View style={styles.purpleHeroDeltaRow}>
                          <Text style={[styles.purpleHeroDeltaPct, up ? styles.purpleDeltaUp : styles.purpleDeltaDown]}>
                            {pctLabel}
                          </Text>
                          <Text style={styles.purpleHeroDeltaText}> vs last month</Text>
                        </View>
                      );
                    })()}
                  </>
                ) : null}
              </View>

              {showTopAddExpenseCta ? (
                <View style={styles.actionCard}>
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionTitle}>Add expense</Text>
                    <Text style={styles.actionText}>Create a bill for {monthName(month)} {year}.</Text>
                  </View>
                  <Pressable onPress={() => setAddSheetOpen(true)} style={styles.actionBtn}>
                    <Ionicons name="add" size={16} color={T.onAccent} />
                    <Text style={styles.actionBtnText}>Add</Text>
                  </Pressable>
                </View>
              ) : null}
              {plans.length > 1 && (
                <View style={styles.planCardsWrap} {...planSwipe.panHandlers}>
					<View style={styles.planTabsBg}>
						<ScrollView
              ref={planScrollRef}
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.planTabsScroll}
              onLayout={(e) => {
                planViewportWidthRef.current = e.nativeEvent.layout.width;
              }}
						>
							{plans.map((p) => {
								const selected = (activePlanId ?? personalPlanId) === p.id;
								return (
									<Pressable
										key={p.id}
										onPress={() => setSelectedPlanId(p.id)}
                    onLayout={(e) => {
                      planItemLayoutsRef.current[p.id] = {
                        x: e.nativeEvent.layout.x,
                        width: e.nativeEvent.layout.width,
                      };
                      if (selected) requestAnimationFrame(scrollPlanIntoView);
                    }}
										style={[styles.planPill, selected && styles.planPillSelected]}
										hitSlop={8}
									>
										<Text style={[styles.planPillText, selected && styles.planPillTextSelected]} numberOfLines={1}>
											{p.name}
										</Text>
									</Pressable>
								);
							})}
						</ScrollView>
					</View>
                </View>
              )}

              {!isPersonalPlan && plans.length > 1 && (summary?.totalCount ?? 0) === 0 && (
                <View style={styles.noExpensesCard}>
                  <Text style={styles.noExpensesTitle}>No expense for this month</Text>
                  <Text style={styles.noExpensesSub}>
                    {monthName(month)} {year}
                  </Text>
                  <Text style={styles.noExpensesHint}>Tap Add above to create your first expense.</Text>
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

      {/* Month Picker Modal */}
      <Modal
        visible={monthPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setMonthPickerOpen(false)} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          {/* Year navigator */}
          <View style={styles.pickerYearRow}>
            <Pressable
              onPress={() => setPickerYear((y) => y - 1)}
              hitSlop={12}
              style={styles.pickerYearBtn}
            >
              <Ionicons name="chevron-back" size={22} color={T.text} />
            </Pressable>
            <Text style={styles.pickerYearText}>{pickerYear}</Text>
            <Pressable
              onPress={() => setPickerYear((y) => y + 1)}
              hitSlop={12}
              style={styles.pickerYearBtn}
              disabled={pickerYear >= now.getFullYear()}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={pickerYear >= now.getFullYear() ? T.textDim : T.text}
              />
            </Pressable>
          </View>
          {/* Month grid */}
          <View style={styles.pickerGrid}>
            {SHORT_MONTHS.map((name, idx) => {
              const m = idx + 1;
              const isFuture =
                pickerYear > now.getFullYear() ||
                (pickerYear === now.getFullYear() && m > now.getMonth() + 1);
              const isSelected = m === month && pickerYear === year;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    if (isFuture) return;
                    setMonth(m);
                    setYear(pickerYear);
                    setMonthPickerOpen(false);
                  }}
                  style={[
                    styles.pickerCell,
                    isSelected && styles.pickerCellSelected,
                    isFuture && styles.pickerCellDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerCellText,
                      isSelected && styles.pickerCellSelectedText,
                      isFuture && styles.pickerCellDisabledText,
                    ]}
                  >
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
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

  actionCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  actionCopy: { flex: 1 },
  actionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  actionText: { marginTop: 2, color: T.textDim, fontSize: 12, fontWeight: "700" },
  actionBtn: {
    minWidth: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: T.accent,
  },
  actionBtnText: { color: T.onAccent, fontSize: 13, fontWeight: "800" },

  planCardsWrap: {
    marginTop: 32,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  planTabsBg: {
    borderRadius: 999,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    padding: 4,
    overflow: "hidden",
  },
  planTabsScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 6,
    gap: 8,
  },
  planPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  planPillSelected: {
    backgroundColor: T.accentDim,
  },
  planPillText: {
    color: T.textDim,
    fontWeight: "800",
    fontSize: 14,
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
  noExpensesHint: {
    marginTop: 6,
    color: T.textMuted,
    fontWeight: "600",
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

  // Purple hero banner
  purpleHero: {
    backgroundColor: "#2a0a9e",
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 10,
  },
  purpleHeroLabelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
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
  purpleHeroDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  purpleHeroDeltaPct: {
    fontSize: 13,
    fontWeight: "900",
  },
  purpleHeroDeltaText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
  },
  purpleDeltaUp: {
    color: "#7fffc0",
  },
  purpleDeltaDown: {
    color: "#ffb3b3",
  },

  // Month picker modal
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  pickerSheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  pickerYearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  pickerYearBtn: {
    padding: 4,
  },
  pickerYearText: {
    color: T.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pickerCell: {
    width: "22%",
    flex: 1,
    minWidth: "22%",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: T.cardAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerCellSelected: {
    backgroundColor: "#2a0a9e",
  },
  pickerCellDisabled: {
    opacity: 0.28,
  },
  pickerCellText: {
    color: T.text,
    fontSize: 14,
    fontWeight: "800",
  },
  pickerCellSelectedText: {
    color: "#ffffff",
  },
  pickerCellDisabledText: {
    color: T.textDim,
  },

  // (Additional-plan per-expense list styles removed; we now show the category cards instead.)
});
