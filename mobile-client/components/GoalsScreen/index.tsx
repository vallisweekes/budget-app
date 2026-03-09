import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
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
import { useFocusEffect, useScrollToTop } from "@react-navigation/native";

import { apiFetch } from "@/lib/api";
import type { Goal } from "@/lib/apiTypes";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { fmt } from "@/lib/formatting";
import { asMoneyNumber, resolveGoalCurrentAmount } from "@/lib/helpers/settings";
import { useTopHeaderOffset } from "@/hooks";
import type { MainTabScreenProps } from "@/navigation/types";
import { T } from "@/lib/theme";
import { s } from "@/components/GoalsScreen/style";
import MoneyInput from "@/components/Shared/MoneyInput";

export default function GoalsScreen({ navigation, route }: MainTabScreenProps<"Goals">) {
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
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [refreshingGoals, setRefreshingGoals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetAmount, setNewTargetAmount] = useState("");
  const [newCurrentAmount, setNewCurrentAmount] = useState("");
  const [newTargetYear, setNewTargetYear] = useState("");
  const lastOpenAddTokenRef = useRef<number | null>(null);
  const skipNextTabFocusReloadRef = useRef(false);

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

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load goals");
    } finally {
      setLoadingGoals(false);
      setRefreshingGoals(false);
    }
  }, [bootstrapError, ensureLoaded, refreshBootstrap]);

  useEffect(() => {
    const tabNavigation = navigation.getParent();
    if (!tabNavigation) return;

    const unsubscribe = tabNavigation.addListener("blur", () => {
      skipNextTabFocusReloadRef.current = true;
    });

    return unsubscribe;
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      if (skipNextTabFocusReloadRef.current) {
        skipNextTabFocusReloadRef.current = false;
        return;
      }
      void load();
    }, [load])
  );

  const openAdd = useCallback(() => {
    setNewTitle("");
    setNewTargetAmount("");
    setNewCurrentAmount("");
    setNewTargetYear("");
    setAddOpen(true);
  }, []);

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
          <Pressable style={s.modalDismissArea} onPress={() => (!adding ? setAddOpen(false) : null)} />
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
          const target = asMoneyNumber((item as any).targetAmount);
          const category = String((item as any).category ?? "").trim().toLowerCase();
          const current = resolveGoalCurrentAmount(category, (item as any).currentAmount, settings);
          const showProgress = Number.isFinite(target) && target > 0;
          const progress = showProgress && Number.isFinite(current) ? Math.max(0, Math.min(1, current / target)) : 0;

          return (
            <Pressable
              onPress={() => navigation.navigate("GoalDetail", { goalId: item.id, goalTitle: item.title })}
              style={({ pressed }) => [s.card, pressed && s.cardPressed]}
            >
              <View style={s.cardTop}>
                <View style={[s.pill, item.targetYear ? null : s.pillWarn]}>
                  <Text style={[s.pillText, item.targetYear ? null : s.pillWarnText]}>
                    {item.targetYear ? `Target ${item.targetYear}` : "Set target year"}
                  </Text>
                </View>

                <View style={s.chevronWrap}>
                  <Ionicons name="chevron-forward" size={20} color={T.iconMuted} />
                </View>
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
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>No goals yet.</Text>}
      />
    </SafeAreaView>
  );
}
