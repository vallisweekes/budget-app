import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useScrollToTop } from "@react-navigation/native";

import { apiFetch } from "@/lib/api";
import type { DashboardData, Goal, Settings } from "@/lib/apiTypes";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { fmt } from "@/lib/formatting";
import { asMoneyNumber } from "@/lib/helpers/settings";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import { cardElevated, textLabel } from "@/lib/ui";
import MoneyInput from "@/components/Shared/MoneyInput";

export default function GoalsScreen({ navigation, route }: { navigation: any; route: any }) {
  const listRef = useRef<SectionList<Goal>>(null);
  useScrollToTop(listRef);
  const topHeaderOffset = useTopHeaderOffset();
  const listTopInset = Math.max(24, topHeaderOffset - 36);

  const {
    dashboard,
    settings,
    isLoading: bootstrapLoading,
    error: bootstrapError,
    refresh: refreshBootstrap,
    ensureLoaded,
  } = useBootstrapData();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [refreshingGoals, setRefreshingGoals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetAmount, setNewTargetAmount] = useState("");
  const [newCurrentAmount, setNewCurrentAmount] = useState("");
  const [newTargetYear, setNewTargetYear] = useState("");

  const [editYearOpen, setEditYearOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editTargetYear, setEditTargetYear] = useState("");
  const [editPending, setEditPending] = useState(false);
  const lastOpenAddTokenRef = useRef<number | null>(null);

  const budgetPlanId = dashboard?.budgetPlanId;

  const loading = bootstrapLoading || loadingGoals;
  const refreshing = refreshingGoals;

  const parseAmount = (raw: string): number | undefined => {
    const t = String(raw ?? "").trim().replace(/,/g, "");
    if (!t) return undefined;
    const n = Number(t);
    if (!Number.isFinite(n)) return undefined;
    if (n < 0) return undefined;
    return Math.round(n * 100) / 100;
  };

  const parseYear = (raw: string): number | null | undefined => {
    const t = String(raw ?? "").trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return undefined;
    const y = Math.floor(n);
    if (y < 1900 || y > 3000) return undefined;
    return y;
  };

  const load = useCallback(async (options?: { force?: boolean }) => {
    try {
      setError(null);

      if (options?.force) setRefreshingGoals(true);
      const { dashboard: dash, settings: s } = options?.force
        ? await refreshBootstrap({ force: true })
        : await ensureLoaded();

      if (!dash || !s) {
        if (bootstrapError) throw bootstrapError;
        throw new Error("Failed to load");
      }

      const planId = dash.budgetPlanId;
      if (planId) {
        const g = await apiFetch<Goal[]>(`/api/bff/goals?budgetPlanId=${encodeURIComponent(planId)}`);
        setGoals(Array.isArray(g) ? g : []);
      } else {
        setGoals([]);
      }

      const nextSelected = (Array.isArray(dash.homepageGoalIds) && dash.homepageGoalIds.length > 0
        ? dash.homepageGoalIds
        : s.homepageGoalIds ?? [])
        .filter((id) => typeof id === "string")
        .slice(0, 2);
      setSelectedIds(nextSelected);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load goals");
    } finally {
      setLoadingGoals(false);
      setRefreshingGoals(false);
    }
  }, [bootstrapError, ensureLoaded, refreshBootstrap]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleDashboardGoal = async (goalId: string) => {
    if (!budgetPlanId) return;
    if (saving) return;

    const next = (() => {
      if (selectedIds.includes(goalId)) return selectedIds.filter((id) => id !== goalId);
      if (selectedIds.length >= 2) return selectedIds;
      return [...selectedIds, goalId];
    })();

    // no-op
    if (next.length === selectedIds.length && next.every((v, i) => v === selectedIds[i])) return;

    setSelectedIds(next);
    try {
      setSaving(true);
      await apiFetch<Settings>("/api/bff/settings", {
        method: "PATCH",
        body: {
          budgetPlanId,
          homepageGoalIds: next,
        },
      });

      // Keep the app-wide cache in sync.
      await refreshBootstrap({ force: true });
    } catch (err: unknown) {
      // revert
      setSelectedIds(selectedIds);
      Alert.alert("Failed to update dashboard goals", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setNewTitle("");
    setNewTargetAmount("");
    setNewCurrentAmount("");
    setNewTargetYear("");
    setAddOpen(true);
  };

  const submitAdd = async () => {
    if (!budgetPlanId) return;
    const title = newTitle.trim();
    if (!title) {
      Alert.alert("Goal title required", "Please enter a goal name.");
      return;
    }

    const targetAmount = parseAmount(newTargetAmount);
    const currentAmount = parseAmount(newCurrentAmount);
    const targetYear = parseYear(newTargetYear);
    if (targetYear === undefined) {
      Alert.alert("Invalid target year", "Please enter a valid year (or leave it blank). ");
      return;
    }

    setAdding(true);
    try {
      await apiFetch<{ goalId: string }>("/api/bff/goals", {
        method: "POST",
        body: {
          budgetPlanId,
          title,
          targetAmount,
          currentAmount,
          targetYear,
        },
      });
      setAddOpen(false);
      await load({ force: true });
    } catch (err: unknown) {
      Alert.alert("Failed to add goal", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAdding(false);
    }
  };

  const openEditYear = (goal: Goal) => {
    setEditingGoal(goal);
    setEditTargetYear(goal.targetYear ? String(goal.targetYear) : "");
    setEditYearOpen(true);
  };

  const submitEditYear = async () => {
    if (!editingGoal) return;
    const nextYear = parseYear(editTargetYear);
    if (nextYear === undefined) {
      Alert.alert("Invalid target year", "Please enter a valid year (or leave it blank). ");
      return;
    }

    setEditPending(true);
    try {
      await apiFetch<Goal>(`/api/bff/goals/${encodeURIComponent(editingGoal.id)}`,
        {
          method: "PATCH",
          body: {
            targetYear: nextYear,
          },
        }
      );
      setEditYearOpen(false);
      setEditingGoal(null);
      await load({ force: true });
    } catch (err: unknown) {
      Alert.alert("Failed to update goal", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEditPending(false);
    }
  };

  const sections = useMemo(() => {
    const byYear = new Map<string, { title: string; year: number | null; data: Goal[] }>();

    for (const goal of goals) {
      const y = typeof goal.targetYear === "number" ? goal.targetYear : null;
      const key = y === null ? "none" : String(y);
      const title = y === null ? "No target year" : `${y} Goals`;
      const existing = byYear.get(key);
      if (existing) existing.data.push(goal);
      else byYear.set(key, { title, year: y, data: [goal] });
    }

    const list = Array.from(byYear.values());
    list.sort((a, b) => {
      if (a.year === null && b.year === null) return 0;
      if (a.year === null) return -1;
      if (b.year === null) return 1;
      return a.year - b.year;
    });

    return list;
  }, [goals]);

  useEffect(() => {
    const token = Number(route?.params?.openAddToken);
    if (!Number.isFinite(token)) return;
    if (lastOpenAddTokenRef.current === token) return;
    lastOpenAddTokenRef.current = token;
    openAdd();
  }, [openAdd, route?.params?.openAddToken]);

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
          <Pressable onPress={() => void load({ force: true })} style={s.retryBtn}>
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
		<SafeAreaView style={s.safe} edges={[]}>
      <Modal
        visible={addOpen}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          if (!adding) setAddOpen(false);
        }}
      >
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => (!adding ? setAddOpen(false) : null)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalCardWrap}>
            <View style={s.modalCard}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Add goal</Text>

              <Text style={s.inputLabel}>Goal name</Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g. Emergency Fund"
                placeholderTextColor={T.textMuted}
                style={s.input}
                editable={!adding}
              />

              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Target amount</Text>
                  <MoneyInput
                    currency={settings?.currency}
                    value={newTargetAmount}
                    onChangeValue={setNewTargetAmount}
                    placeholder="e.g. 40000"
                    editable={!adding}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Current amount</Text>
                  <MoneyInput
                    currency={settings?.currency}
                    value={newCurrentAmount}
                    onChangeValue={setNewCurrentAmount}
                    placeholder="e.g. 200"
                    editable={!adding}
                  />
                </View>
              </View>

              <Text style={s.inputLabel}>Target year (optional)</Text>
              <TextInput
                value={newTargetYear}
                onChangeText={setNewTargetYear}
                placeholder="e.g. 2035"
                placeholderTextColor={T.textMuted}
                style={s.input}
                keyboardType="number-pad"
                editable={!adding}
              />

              <View style={s.modalBtns}>
                <Pressable
                  onPress={() => setAddOpen(false)}
                  disabled={adding}
                  style={[s.modalBtn, s.modalBtnGhost, adding && s.disabled]}
                >
                  <Text style={s.modalBtnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={submitAdd}
                  disabled={adding}
                  style={[s.modalBtn, s.modalBtnPrimary, adding && s.disabled]}
                >
                  {adding ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.modalBtnPrimaryText}>Add</Text>}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={editYearOpen}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          if (!editPending) setEditYearOpen(false);
        }}
      >
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => (!editPending ? setEditYearOpen(false) : null)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalCardWrap}>
            <View style={s.modalCard}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Target year</Text>
              <Text style={s.modalSubtitle}>{editingGoal?.title ?? ""}</Text>

              <Text style={s.inputLabel}>Year (leave blank to clear)</Text>
              <TextInput
                value={editTargetYear}
                onChangeText={setEditTargetYear}
                placeholder="e.g. 2035"
                placeholderTextColor={T.textMuted}
                style={s.input}
                keyboardType="number-pad"
                editable={!editPending}
              />

              <View style={s.modalBtns}>
                <Pressable
                  onPress={() => setEditYearOpen(false)}
                  disabled={editPending}
                  style={[s.modalBtn, s.modalBtnGhost, editPending && s.disabled]}
                >
                  <Text style={s.modalBtnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={submitEditYear}
                  disabled={editPending}
                  style={[s.modalBtn, s.modalBtnPrimary, editPending && s.disabled]}
                >
                  {editPending ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.modalBtnPrimaryText}>Save</Text>}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        stickyHeaderHiddenOnScroll={false}
        style={{ marginTop: listTopInset }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void load({ force: true });
            }}
            tintColor={T.accent}
          />
        }
        contentContainerStyle={s.list}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item.id);
          const target = asMoneyNumber((item as any).targetAmount);
          const rawCurrent = asMoneyNumber((item as any).currentAmount);
          const category = String((item as any).category ?? "").trim().toLowerCase();
          const settingsFallback =
            category === "emergency"
              ? asMoneyNumber(settings?.emergencyBalance)
              : category === "savings"
                ? asMoneyNumber(settings?.savingsBalance)
                : category === "investment"
                  ? asMoneyNumber(settings?.investmentBalance)
                  : 0;
          const current = rawCurrent > 0 ? rawCurrent : (settingsFallback > 0 ? settingsFallback : 0);
          const showProgress = Number.isFinite(target) && target > 0;
          const progress = showProgress && Number.isFinite(current) ? Math.max(0, Math.min(1, current / target)) : 0;

          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Pressable
                  onPress={() => openEditYear(item)}
                  hitSlop={8}
                  style={[s.pill, item.targetYear ? null : s.pillWarn]}
                >
                  <Text style={[s.pillText, item.targetYear ? null : s.pillWarnText]}>
                    {item.targetYear ? `Target ${item.targetYear}` : "Set target year"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => toggleDashboardGoal(item.id)}
                  disabled={saving}
                  hitSlop={10}
                  style={s.dashToggle}
                >
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={selected ? T.accent : T.iconMuted}
                  />
                </Pressable>
              </View>

              <Text style={s.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>

              {item.description ? (
                <Text style={s.cardDesc} numberOfLines={3}>
                  {item.description}
                </Text>
              ) : null}

              {showProgress ? (
                <View style={{ marginTop: 10 }}>
                  <View style={s.progressRow}>
                    <Text style={s.progressLabel}>Progress</Text>
                    <Text style={s.progressValue}>
                      {fmt(current, settings?.currency ?? undefined)} / {fmt(target, settings?.currency ?? undefined)}
                    </Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                  <Text style={s.progressPct}>{(progress * 100).toFixed(1)}% complete</Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>No goals yet.</Text>}
      />
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

  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { color: T.textDim, fontStyle: "italic", paddingVertical: 12 },

  sectionHeader: {
    backgroundColor: "transparent",
    paddingTop: 14,
    paddingBottom: 10,
    zIndex: 2,
  },
  sectionTitle: {
    color: T.text,
    fontSize: 18,
    fontWeight: "900",
  },

  card: {
    ...cardElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: T.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  pillWarn: {
    borderColor: T.orange,
  },
  pillText: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "800",
  },
  pillWarnText: {
    color: T.orange,
  },
  dashToggle: {
    padding: 4,
  },
  cardTitle: {
    color: T.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  cardDesc: {
    marginTop: 6,
    color: T.textDim,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: { ...textLabel },
  progressValue: {
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: T.border,
    overflow: "hidden",
  },
  progressFill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: T.accent,
  },
  progressPct: {
    marginTop: 6,
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCardWrap: {
    width: "100%",
  },
  modalCard: {
    backgroundColor: T.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: T.border,
    marginBottom: 10,
  },
  modalTitle: { color: T.text, fontSize: 16, fontWeight: "900" },
  modalSubtitle: { color: T.textDim, fontSize: 12, fontWeight: "700", marginTop: 4 },
  inputLabel: { color: T.textDim, fontSize: 12, fontWeight: "800", marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: T.text,
    fontSize: 14,
    fontWeight: "700",
  },
  row2: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnPrimary: {
    backgroundColor: T.accent,
  },
  modalBtnPrimaryText: {
    color: T.onAccent,
    fontSize: 14,
    fontWeight: "900",
  },
  modalBtnGhost: {
    backgroundColor: T.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.accentBorder,
  },
  modalBtnGhostText: {
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
  },
  disabled: { opacity: 0.55 },
});
