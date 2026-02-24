import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Pressable,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { DashboardData, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt, MONTH_NAMES_SHORT } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { cardElevated, textLabel } from "@/lib/ui";
import BudgetDonutCard from "@/components/Dashboard/BudgetDonutCard";
import CategorySwipeCards from "@/components/Dashboard/CategorySwipeCards";

const W = Dimensions.get("window").width;
const GOAL_GAP = 12;
const GOAL_SIDE = 16;
// Fit two cards side-by-side by default (with side padding + gap)
const GOAL_CARD = Math.max(122, Math.round((W - GOAL_SIDE * 2 - GOAL_GAP) / 2));
const GOAL_ADD_W = Math.max(52, Math.round(GOAL_CARD * 0.34));

export default function DashboardScreen({ navigation }: { navigation: any }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categorySheet, setCategorySheet] = useState<{ id: string; name: string } | null>(null);
  const [aiTipIndex, setAiTipIndex] = useState(0);
  const [activeGoalCard, setActiveGoalCard] = useState(0);

  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalCurrent, setNewGoalCurrent] = useState("");
  const [creatingGoal, setCreatingGoal] = useState(false);

  const currency = currencySymbol(settings?.currency);

  const goalIconName = (title: string): keyof typeof Ionicons.glyphMap => {
    const t = String(title ?? "").toLowerCase();
    if (t.includes("emergency")) return "shield-outline";
    if (t.includes("saving")) return "cash-outline";
    return "flag-outline";
  };

  const parseAmount = (raw: string): number | undefined => {
    const t = String(raw ?? "").trim().replace(/,/g, "");
    if (!t) return undefined;
    const n = Number(t);
    if (!Number.isFinite(n)) return undefined;
    if (n < 0) return undefined;
    return Math.round(n * 100) / 100;
  };

  const openAddGoal = () => {
    setNewGoalTitle("");
    setNewGoalTarget("");
    setNewGoalCurrent("");
    setAddGoalOpen(true);
  };

  const submitNewGoal = async () => {
    const budgetPlanId = dashboard?.budgetPlanId;
    if (!budgetPlanId) return;

    const title = newGoalTitle.trim();
    if (!title) {
      Alert.alert("Goal title required", "Please enter a goal name.");
      return;
    }

    const targetAmount = parseAmount(newGoalTarget);
    const currentAmount = parseAmount(newGoalCurrent);

    setCreatingGoal(true);
    try {
      await apiFetch<{ goalId: string }>("/api/bff/goals", {
        method: "POST",
        body: {
          budgetPlanId,
          title,
          targetAmount,
          currentAmount,
        },
      });

      setAddGoalOpen(false);
      await load();
    } catch (err: unknown) {
      Alert.alert("Failed to add goal", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreatingGoal(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      // Fetch computed dashboard + settings in parallel.
      // All budget calculations happen server-side — same logic as the web client.
      const [dash, s] = await Promise.all([
        apiFetch<DashboardData>("/api/bff/dashboard"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setDashboard(dash);
      setSettings(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const tips = dashboard?.expenseInsights?.recapTips ?? [];

  useEffect(() => {
    if (aiTipIndex >= tips.length) setAiTipIndex(0);
  }, [tips.length, aiTipIndex]);

  useEffect(() => {
    if (tips.length <= 1) return;
    const id = setInterval(() => {
      setAiTipIndex((i) => (i + 1) % tips.length);
    }, 20_000);
    return () => clearInterval(id);
  }, [tips.length]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.iconMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // All values are pre-computed server-side — no client-side math needed
  const totalIncome = dashboard?.totalIncome ?? 0;
  const totalExpenses = dashboard?.totalExpenses ?? 0;
  const incomeAfterAllocations = dashboard?.incomeAfterAllocations ?? 0;
  const categories = dashboard?.categoryData ?? [];
  const goals = dashboard?.goals ?? [];
  const debts = dashboard?.debts ?? [];
  const monthNum = dashboard?.monthNum ?? new Date().getMonth() + 1;
  const year = dashboard?.year ?? new Date().getFullYear();
  const payDate = dashboard?.payDate ?? settings?.payDate ?? 1;

  // Expense stats from category data
  const allExpenses = categories.flatMap((c) => c.expenses);

  // Budget utilisation — match web client's StatsGrid logic
  // "Income" card = income left to budget (after allocations & debt payments)
  const amountLeftToBudget = incomeAfterAllocations;
  // "Amount Left" card = income left to budget minus expenses
  const amountAfterExpenses = amountLeftToBudget - totalExpenses;
  const isOverBudget = amountAfterExpenses < 0;

  const paidTotal = allExpenses.reduce((acc, e) => acc + (e.paidAmount ?? (e.paid ? e.amount : 0)), 0);
  const totalBudget = amountLeftToBudget > 0 ? amountLeftToBudget : totalIncome;

  const clampDay = (y: number, monthIndex: number, day: number) => {
    const lastDay = new Date(y, monthIndex + 1, 0).getDate();
    return new Date(y, monthIndex, Math.min(Math.max(1, day), lastDay));
  };

  const pay = payDate ?? 1;
  const monthIndex = monthNum - 1;
  const end = clampDay(year, monthIndex, pay);
  end.setDate(end.getDate() - 1);
  const start = clampDay(year, monthIndex - 1, pay);
  start.setDate(start.getDate() + 1);

  const rangeLabel = `${start.getDate()} ${MONTH_NAMES_SHORT[start.getMonth()]} - ${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]}`;

  // Upcoming payments & tips from server-computed insights
  const upcoming = (dashboard?.expenseInsights?.upcoming ?? []).filter((u) => {
    const n = String(u.name ?? "").trim().toLowerCase();
    // Explicitly hide the Housing rent line on Home.
    if (n === "housing: rent" || n === "houing: rent") return false;
    if (n.startsWith("housing") && n.includes("rent")) return false;
    return true;
  });

  const getDebtDueAmount = (d: (typeof debts)[number]) => {
    // Match web-client getDebtMonthlyPayment()
    if ((d.installmentMonths ?? 0) > 0 && (d.currentBalance ?? 0) > 0) {
      const installment = (d.currentBalance ?? 0) / (d.installmentMonths ?? 1);
      const min = d.monthlyMinimum ?? 0;
      const eff = min > installment ? min : installment;
      return Math.min(d.currentBalance ?? 0, eff);
    }
    if ((d.monthlyMinimum ?? 0) > 0) {
      return Math.min(d.currentBalance ?? 0, d.monthlyMinimum ?? 0);
    }
    return Math.min(d.currentBalance ?? 0, d.amount ?? 0);
  };

  const upcomingDebts = debts
    .filter((d) => (d.currentBalance ?? 0) > 0)
    .map((d) => ({ ...d, dueAmount: getDebtDueAmount(d) }))
    .filter((d) => (d.dueAmount ?? 0) > 0)
    .sort((a, b) => (b.dueAmount ?? 0) - (a.dueAmount ?? 0));

  const formatShortDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
  };

  const selectedCategory = categorySheet ? categories.find((c) => c.id === categorySheet.id) : undefined;
  const selectedExpenses = (selectedCategory?.expenses ?? []).slice().sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

  const preferredGoalIds = Array.isArray(dashboard?.homepageGoalIds) ? dashboard.homepageGoalIds : [];
  const goalsToShow = (() => {
    const byId = new Map(goals.map((g) => [g.id, g] as const));
    const preferred = preferredGoalIds
      .map((id) => byId.get(id))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
    if (preferred.length >= 2) return preferred.slice(0, 2);

    const used = new Set(preferred.map((g) => g.id));
    const fallback = goals.filter((g) => !used.has(g.id));
    return [...preferred, ...fallback].slice(0, 2);
  })();

  const goalCardsData = [{ kind: "add" as const }, ...goalsToShow.map((g) => ({ kind: "goal" as const, goal: g }))];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <Modal
        visible={!!categorySheet}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setCategorySheet(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCategorySheet(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {categorySheet?.name ?? "Category"}
              </Text>
              <Pressable onPress={() => setCategorySheet(null)} hitSlop={10} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={22} color={T.text} />
              </Pressable>
            </View>

            <FlatList
              data={selectedExpenses}
              keyExtractor={(i) => i.id}
              contentContainerStyle={styles.sheetList}
              ListEmptyComponent={() => (
                <Text style={styles.sheetEmpty}>No expenses in this category.</Text>
              )}
              renderItem={({ item }) => (
                <View style={styles.sheetRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.sheetRowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.sheetRowSub}>
                      {item.paid ? "paid" : (item.paidAmount ?? 0) > 0 ? "partial" : "unpaid"}
                    </Text>
                  </View>
                  <Text style={styles.sheetRowAmt} numberOfLines={1}>
                    {fmt(item.amount, currency)}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={addGoalOpen}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setAddGoalOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddGoalOpen(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <View style={styles.goalSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.goalSheetHeader}>
                <Text style={styles.goalSheetTitle}>Add goal</Text>
                <Pressable onPress={() => setAddGoalOpen(false)} hitSlop={10} style={styles.goalSheetCloseBtn}>
                  <Ionicons name="close" size={20} color={T.text} />
                </Pressable>
              </View>

              <View style={styles.goalForm}>
                <Text style={styles.goalLabel}>Goal name</Text>
                <TextInput
                  value={newGoalTitle}
                  onChangeText={setNewGoalTitle}
                  placeholder="e.g. Emergency Fund"
                  placeholderTextColor={T.textMuted}
                  style={styles.goalInput}
                  editable={!creatingGoal}
                  returnKeyType="next"
                />

                <Text style={styles.goalLabel}>Target amount (optional)</Text>
                <TextInput
                  value={newGoalTarget}
                  onChangeText={setNewGoalTarget}
                  placeholder="e.g. 40000"
                  placeholderTextColor={T.textMuted}
                  style={styles.goalInput}
                  keyboardType="decimal-pad"
                  editable={!creatingGoal}
                />

                <Text style={styles.goalLabel}>Current amount (optional)</Text>
                <TextInput
                  value={newGoalCurrent}
                  onChangeText={setNewGoalCurrent}
                  placeholder="e.g. 200"
                  placeholderTextColor={T.textMuted}
                  style={styles.goalInput}
                  keyboardType="decimal-pad"
                  editable={!creatingGoal}
                />

                <View style={styles.goalBtnRow}>
                  <Pressable
                    onPress={() => setAddGoalOpen(false)}
                    style={[styles.goalBtn, styles.goalBtnGhost]}
                    disabled={creatingGoal}
                  >
                    <Text style={styles.goalBtnGhostText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={submitNewGoal}
                    style={[styles.goalBtn, styles.goalBtnPrimary, creatingGoal && styles.goalBtnDisabled]}
                    disabled={creatingGoal}
                  >
                    <Text style={styles.goalBtnPrimaryText}>{creatingGoal ? "Adding…" : "Add"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.rangePill}>
          <Text style={styles.rangeText}>{rangeLabel}</Text>
        </View>

        <BudgetDonutCard
          totalBudget={totalBudget}
          totalExpenses={totalExpenses}
          paidTotal={paidTotal}
          currency={currency}
          fmt={fmt}
        />

        <CategorySwipeCards
          categories={categories}
          totalIncome={totalIncome}
          currency={currency}
          fmt={fmt}
          onPressCategory={(c) => setCategorySheet(c)}
        />

        {/* Upcoming Payments (show 3 + See all) */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Expenses</Text>
            {upcoming.slice(0, 3).map((p) => {
              const dateLabel = formatShortDate(p.dueDate);
              const sub =
                p.urgency === "overdue"
                  ? "Overdue"
                  : p.urgency === "today"
                    ? "Due today"
                    : dateLabel
                      ? `Next on ${dateLabel}`
                      : `In ${p.daysUntilDue}d`;

              return (
                <View key={p.id} style={styles.lightRow}>
                  <View style={styles.lightLeft}>
                    <View style={styles.lightAvatar}>
                      <Text style={styles.lightAvatarTxt}>{(p.name?.trim()?.[0] ?? "?").toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lightRowTitle} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.lightRowSub} numberOfLines={1}>
                        {sub}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.lightRowAmt} numberOfLines={1}>
                    {fmt(p.amount, currency)}
                  </Text>
                </View>
              );
            })}
            <Pressable onPress={() => navigation.navigate("Payments")} style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          </View>
        )}

        {/* Upcoming Debts */}
        {upcomingDebts.length > 0 && (
          <View style={[styles.section, styles.blueSection]}>
            <Text style={[styles.sectionTitle, styles.blueSectionTitle]}>Upcoming Debts</Text>
            {upcomingDebts.slice(0, 5).map((d) => (
              <View key={d.id} style={styles.blueRow}>
                <View style={styles.blueLeft}>
                  <View style={styles.blueAvatar}>
                    <Text style={styles.blueAvatarTxt}>{(d.name?.trim()?.[0] ?? "D").toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.blueRowTitle} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={styles.blueRowSub} numberOfLines={1}>
                      Monthly payment
                    </Text>
                  </View>
                </View>
                <Text style={styles.blueRowAmt} numberOfLines={1}>
                  {fmt(d.dueAmount, currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Goals (swipe cards) */}
        {dashboard ? (
          <View style={styles.goalsWrap}>
            <View style={styles.goalsHeaderRow}>
              <Pressable onPress={() => navigation.navigate("Goals")} hitSlop={8}>
                <Text style={styles.seeAllGoalsText}>See all goals</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate("GoalsProjection")} hitSlop={8}>
                <Text style={styles.goalsProjectionTitle}>Goals projection</Text>
              </Pressable>
            </View>

            <FlatList
              horizontal
              data={goalCardsData}
              keyExtractor={(i) => (i.kind === "add" ? "__add" : i.goal.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: GOAL_SIDE }}
              bounces
              onMomentumScrollEnd={(e) => {
                // Best-effort active indicator without fixed snap (last card is half-width)
                const x = e.nativeEvent.contentOffset.x;
                const idx = Math.round(x / (GOAL_CARD + GOAL_GAP));
                setActiveGoalCard(Math.max(0, Math.min(goalCardsData.length - 1, idx)));
              }}
              renderItem={({ item }) => {
                if (item.kind === "add") {
                  return (
                    <Pressable onPress={openAddGoal} style={[styles.goalCard, styles.goalCardAdd]}>
                      <View style={styles.goalCardAddInner}>
                        <Ionicons name="add" size={28} color={T.accent} />
                      </View>
                    </Pressable>
                  );
                }

                const g = item.goal;
                const hasTarget = typeof g.targetAmount === "number" && Number.isFinite(g.targetAmount);
                const curAmt = typeof g.currentAmount === "number" && Number.isFinite(g.currentAmount) ? g.currentAmount : 0;
                const tgtAmt = hasTarget ? (g.targetAmount as number) : null;
                const pct = tgtAmt && tgtAmt > 0 ? Math.min(100, Math.max(0, (curAmt / tgtAmt) * 100)) : 0;
                const primaryAmount = fmt(curAmt, currency);
                const amountLine = tgtAmt ? `Target ${fmt(tgtAmt, currency)}` : String(g.type ?? "");
                const pctLabel = tgtAmt ? `${pct.toFixed(0)}%` : "";

                return (
                  <View style={styles.goalCard}>
                    <View style={styles.goalHeaderRow}>
                      <View style={styles.goalHeaderLeft}>
                        <View style={styles.goalChip}>
                          <Ionicons name={goalIconName(g.title)} size={16} color={T.accent} />
                        </View>
                        <Text style={styles.goalTitle} numberOfLines={1}>
                          {g.title}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.goalMainBlock}>
                      <Text style={styles.goalPrimaryAmt} numberOfLines={1}>
                        {primaryAmount}
                      </Text>
                      <Text style={styles.goalAmountLine} numberOfLines={1}>
                        {amountLine}
                      </Text>
                      {tgtAmt ? (
                        <View style={styles.goalPctRow}>
                          <View style={styles.goalPctPill}>
                            <Ionicons name="arrow-up" size={12} color={T.accent} />
                            <Text style={styles.goalPctText}>{pctLabel}</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>

                    {tgtAmt ? (
                      <View style={styles.goalBarBg}>
                        <View style={[styles.goalBarFill, { width: `${pct}%` as `${number}%` }]} />
                      </View>
                    ) : (
                      <View style={{ height: 10 }} />
                    )}
                  </View>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ width: GOAL_GAP }} />}
            />

            {goalCardsData.length > 1 ? (
              <View style={styles.goalIndicatorWrap}>
                {goalCardsData.map((_, i) => (
                  <View key={i} style={[styles.goalIndicatorDot, i === activeGoalCard ? styles.goalIndicatorDotActive : null]} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Tips / Insights */}
        {tips.length > 0 && (
          <View style={styles.section}>
            {(() => {
              const tip = tips[aiTipIndex] ?? tips[0];
              const message = String(tip?.detail ?? tip?.title ?? "").trim();
              return (
                <View style={styles.aiCard}>
                  <View style={styles.aiHeader}>
                    <View style={styles.aiIconWrap}>
                      <Ionicons name="sparkles-outline" size={16} color={T.accent} />
                    </View>
                    <Text style={styles.aiTitle}>Ai Insight</Text>
                  </View>

                  <Text style={styles.aiMessage} numberOfLines={3}>
                    {message}
                  </Text>
                </View>
              );
            })()}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: T.cardAlt,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    maxHeight: "82%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: T.textMuted,
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  sheetTitle: { color: T.text, fontSize: 18, fontWeight: "900", flex: 1 },
  sheetCloseBtn: { marginLeft: 12 },
  sheetList: { paddingHorizontal: 16, paddingBottom: 24 },
  sheetEmpty: { color: T.textDim, fontSize: 13, fontStyle: "italic", paddingVertical: 12 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  sheetRowName: { color: T.text, fontSize: 14, fontWeight: "800" },
  sheetRowSub: { color: T.textDim, fontSize: 12, fontWeight: "700", marginTop: 2 },
  sheetRowAmt: { color: T.text, fontSize: 16, fontWeight: "900" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { padding: 16, paddingTop: 18, paddingBottom: 140 },
  headerRow: { marginBottom: 14 },
  rangePill: {
    alignSelf: "flex-start",
    backgroundColor: T.card,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 12,
  },
  rangeText: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  seeAllBtn: {
    marginTop: 6,
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  seeAllText: { color: T.accent, fontSize: 14, fontWeight: "900" },
  period: { color: T.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  section: {
    ...cardElevated,
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    ...textLabel,
    fontWeight: "800",
    marginBottom: 10,
  },

  // Upcoming Expenses (white card) rows
  lightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 12,
  },
  lightLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  lightAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  lightAvatarTxt: { color: T.text, fontSize: 14, fontWeight: "800" },
  lightRowTitle: { color: T.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  lightRowSub: { color: T.textDim, fontSize: 13, fontWeight: "600", marginTop: 2 },
  lightRowAmt: { color: T.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },

  // Upcoming Debts (blue card)
  blueSection: {
    backgroundColor: T.cardAlt,
    borderColor: T.border,
  },
  blueSectionTitle: {
    color: T.textDim,
  },
  blueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 14,
  },
  blueLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 14 },
  blueAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  blueAvatarTxt: { color: T.accent, fontSize: 14, fontWeight: "800" },
  blueRowTitle: { color: T.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  blueRowSub: { color: T.textDim, fontSize: 13, fontWeight: "600", marginTop: 2 },
  blueRowAmt: { color: T.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  loadingText: { color: T.textDim, marginTop: 12, fontSize: 14 },
  errorText: { color: T.red, marginTop: 12, fontSize: 15, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { marginTop: 16, backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: T.onAccent, fontWeight: "700" },
  emptyText: { color: T.textDim, fontSize: 13, fontStyle: "italic", paddingVertical: 6, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginVertical: 10 },

  aiCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center",
  },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  aiMessage: {
    marginTop: 10,
    color: T.textDim,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
  },

  // Goals swipe cards
  goalsWrap: { marginTop: 12, marginHorizontal: -16 },
  goalsHeaderRow: {
    paddingHorizontal: GOAL_SIDE,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seeAllGoalsText: {
    color: T.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  goalsProjectionTitle: {
    color: T.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  goalCard: {
    width: GOAL_CARD,
    height: GOAL_CARD,
    ...cardElevated,
    padding: 14,
    justifyContent: "space-between",
  },
  goalCardAdd: {
    width: GOAL_ADD_W,
    alignItems: "center",
    justifyContent: "center",
  },
  goalCardAddInner: { alignItems: "center", justifyContent: "center", gap: 8 },
  goalHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0, gap: 10 },
  goalChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  goalMainBlock: { flex: 1, justifyContent: "center" },
  goalPrimaryAmt: {
    marginTop: 10,
    color: T.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  goalPctRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "flex-start" },
  goalPctPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: T.accentDim,
  },
  goalPctText: { color: T.accent, fontSize: 11, fontWeight: "700" },
  goalIndicatorWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 10,
    gap: 6,
  },
  goalIndicatorDot: {
    height: 4,
    width: 6,
    borderRadius: 999,
    backgroundColor: T.textMuted,
  },
  goalIndicatorDotActive: {
    width: 18,
    backgroundColor: T.accent,
  },

  // Add goal sheet
  goalSheet: {
    backgroundColor: T.cardAlt,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: "82%",
  },
  goalSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  goalSheetTitle: { color: T.text, fontSize: 18, fontWeight: "900", flex: 1 },
  goalSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  goalForm: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  goalLabel: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  goalInput: {
    backgroundColor: T.card,
    color: T.text,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  goalBtnRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  goalBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  goalBtnGhost: {
    backgroundColor: T.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  goalBtnGhostText: { color: T.text, fontSize: 15, fontWeight: "800" },
  goalBtnPrimary: { backgroundColor: T.accent },
  goalBtnPrimaryText: { color: T.onAccent, fontSize: 15, fontWeight: "900" },
  goalBtnDisabled: { opacity: 0.6 },
  goalBarBg: {
    height: 12,
    borderRadius: 999,
    backgroundColor: T.border,
    overflow: "hidden",
    marginTop: 10,
    marginBottom: 8,
  },
  goalBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: T.accent,
  },

  goalItem: {
    paddingVertical: 14,
  },
  goalItemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  goalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  goalIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  goalTextCol: {
    flex: 1,
    minWidth: 0,
  },
  goalTitle: {
    color: T.text,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: -0.2,
    flex: 1,
    minWidth: 0,
  },
  goalAmountLine: {
    marginTop: 2,
    color: T.textDim,
    fontSize: 11,
    fontWeight: "400",
  },
  aiTitle: { color: T.text, fontSize: 16, fontWeight: "900" },
});
