import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { apiFetch } from "@/lib/api";
import type { Goal, Settings } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { resolveGoalCurrentAmount } from "@/lib/helpers/settings";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import type { RootStackParamList } from "@/navigation/types";
import { getEffectiveHomepageGoals } from "@/components/DashboardScreen/derived";
import { T } from "@/lib/theme";
import { cardElevated, textLabel } from "@/lib/ui";
import MoneyInput from "@/components/Shared/MoneyInput";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";

type GoalDetailRoute = RouteProp<RootStackParamList, "GoalDetail">;
type GoalDetailNav = NativeStackNavigationProp<RootStackParamList, "GoalDetail">;

export default function GoalDetailScreen() {
  const navigation = useNavigation<GoalDetailNav>();
  const { params } = useRoute<GoalDetailRoute>();
  const topHeaderOffset = useTopHeaderOffset();
  const { dashboard, settings, ensureLoaded, refresh: refreshBootstrap } = useBootstrapData();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetYear, setTargetYear] = useState("");
  const [showOnHome, setShowOnHome] = useState(false);

  const parseAmount = useCallback((raw: string): number | null | undefined => {
    const trimmed = String(raw ?? "").trim().replace(/,/g, "");
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return undefined;
    return Math.round(parsed * 100) / 100;
  }, []);

  const parseYear = useCallback((raw: string): number | null | undefined => {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return undefined;
    const year = Math.floor(parsed);
    if (year < 1900 || year > 3000) return undefined;
    return year;
  }, []);

  const effectiveHomepageGoals = useMemo(() => {
    const dashboardGoals = Array.isArray(dashboard?.goals) ? dashboard.goals : [];
    return getEffectiveHomepageGoals(dashboardGoals, settings?.homepageGoalIds);
  }, [dashboard?.goals, settings?.homepageGoalIds]);

  const effectiveHomepageGoalIds = useMemo(() => {
    return new Set(effectiveHomepageGoals.map((item) => item.id));
  }, [effectiveHomepageGoals]);

  const populateForm = useCallback((nextGoal: Goal, nextSettings: Settings | null) => {
    const dashboardGoals = Array.isArray(dashboard?.goals) ? dashboard.goals : [];
    const nextEffectiveHomepageGoalIds = new Set(getEffectiveHomepageGoals(dashboardGoals, nextSettings?.homepageGoalIds).map((item) => item.id));
    setGoal(nextGoal);
    setTitle(String(nextGoal.title ?? ""));
    setDescription(String(nextGoal.description ?? ""));
    setTargetAmount(nextGoal.targetAmount ? String(nextGoal.targetAmount) : "");
    setTargetYear(nextGoal.targetYear ? String(nextGoal.targetYear) : "");
    setShowOnHome(nextEffectiveHomepageGoalIds.has(nextGoal.id));
  }, [dashboard?.goals]);

  const load = useCallback(async (options?: { force?: boolean }) => {
    try {
      setError(null);
      if (options?.force) setRefreshing(true);

      const [{ settings: nextSettings }, nextGoal] = await Promise.all([
        options?.force ? refreshBootstrap({ force: true }) : ensureLoaded(),
        apiFetch<Goal>(`/api/bff/goals/${encodeURIComponent(params.goalId)}`, { cacheTtlMs: 0 }),
      ]);

      populateForm(nextGoal, nextSettings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load goal");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ensureLoaded, params.goalId, populateForm, refreshBootstrap]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const isDirty = useMemo(() => {
    if (!goal) return false;
    const currentDescription = goal.description ?? "";
    const currentTargetAmount = goal.targetAmount ? String(goal.targetAmount) : "";
    const currentTargetYear = goal.targetYear ? String(goal.targetYear) : "";
    const currentShowOnHome = effectiveHomepageGoalIds.has(goal.id);
    return title.trim() !== goal.title
      || description.trim() !== currentDescription
      || targetAmount.trim() !== currentTargetAmount
      || targetYear.trim() !== currentTargetYear
      || showOnHome !== currentShowOnHome;
  }, [description, effectiveHomepageGoalIds, goal, showOnHome, targetAmount, targetYear, title]);

  const handleSave = useCallback(async () => {
    if (!goal) return;

    const nextTitle = title.trim();
    if (!nextTitle) {
      Alert.alert("Goal title required", "Please enter a goal name.");
      return;
    }

    const nextTargetAmount = parseAmount(targetAmount);
    if (typeof nextTargetAmount === "undefined") {
      Alert.alert("Invalid target amount", "Please enter a valid target amount.");
      return;
    }

    const nextTargetYear = parseYear(targetYear);
    if (typeof nextTargetYear === "undefined") {
      Alert.alert("Invalid target year", "Please enter a valid year or leave it blank.");
      return;
    }

    const budgetPlanId = dashboard?.budgetPlanId ?? goal.budgetPlanId ?? null;
    const currentEffectiveHomepageGoalIds = effectiveHomepageGoals.map((item) => item.id);
    const allDashboardGoalIds = Array.isArray(dashboard?.goals) ? dashboard.goals.map((item) => item.id) : [];

    let nextHomepageGoalIds = currentEffectiveHomepageGoalIds;
    if (showOnHome) {
      if (!currentEffectiveHomepageGoalIds.includes(goal.id)) {
        nextHomepageGoalIds = [...currentEffectiveHomepageGoalIds, goal.id].slice(0, 2);
      }
    } else {
      const remaining = currentEffectiveHomepageGoalIds.filter((id) => id !== goal.id);
      const fillers = allDashboardGoalIds.filter((id) => id !== goal.id && !remaining.includes(id));
      nextHomepageGoalIds = [...remaining, ...fillers].slice(0, 2);
    }

    if (showOnHome && !currentEffectiveHomepageGoalIds.includes(goal.id) && currentEffectiveHomepageGoalIds.length >= 2) {
      Alert.alert("Home goals limit", "You can show up to two goals on Home. Remove one there first.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch<Goal>(`/api/bff/goals/${encodeURIComponent(goal.id)}`, {
        method: "PATCH",
        body: {
          title: nextTitle,
          description: description.trim() ? description.trim() : null,
          targetAmount: nextTargetAmount,
          targetYear: nextTargetYear,
        },
      });

      if (budgetPlanId) {
        await apiFetch<Settings>("/api/bff/settings", {
          method: "PATCH",
          body: {
            budgetPlanId,
            homepageGoalIds: nextHomepageGoalIds,
          },
        });
      }

      await refreshBootstrap({ force: true });
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Failed to save goal", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }, [dashboard?.budgetPlanId, dashboard?.goals, description, effectiveHomepageGoals, goal, navigation, parseAmount, parseYear, refreshBootstrap, showOnHome, targetAmount, targetYear, title]);

  const handleDelete = useCallback(async () => {
    if (!goal) return;
    setDeleting(true);
    try {
      const budgetPlanId = dashboard?.budgetPlanId ?? goal.budgetPlanId ?? null;
      const currentHomepageGoalIds = Array.isArray(settings?.homepageGoalIds) ? settings.homepageGoalIds : [];
      await apiFetch(`/api/bff/goals/${encodeURIComponent(goal.id)}`, { method: "DELETE" });
      if (budgetPlanId && currentHomepageGoalIds.includes(goal.id)) {
        await apiFetch<Settings>("/api/bff/settings", {
          method: "PATCH",
          body: {
            budgetPlanId,
            homepageGoalIds: currentHomepageGoalIds.filter((id) => id !== goal.id),
          },
        });
      }
      await refreshBootstrap({ force: true });
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Failed to delete goal", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }, [dashboard?.budgetPlanId, goal, navigation, refreshBootstrap, settings?.homepageGoalIds]);

  const targetAmountNumber = parseAmount(targetAmount);
  const category = String(goal?.category ?? "").trim().toLowerCase();
  const currentAmountNumber = resolveGoalCurrentAmount(category, goal?.currentAmount, settings);
  const progress = goal && typeof targetAmountNumber === "number" && targetAmountNumber > 0 && typeof currentAmountNumber === "number"
    ? Math.max(0, Math.min(1, currentAmountNumber / targetAmountNumber))
    : 0;

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.info}>Loading goal…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !goal) {
    return (
      <SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={[]}>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={46} color={T.textDim} />
          <Text style={s.error}>{error ?? "Goal not found"}</Text>
          <Pressable onPress={() => void load({ force: true })} style={s.retryBtn}>
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: topHeaderOffset + 10 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ force: true })} tintColor={T.accent} />}
        >
          <View style={s.heroCard}>
            <View style={s.heroHeader}>
              <Text style={s.heroTitle}>{goal.title}</Text>
              <Ionicons name="create-outline" size={18} color={T.accent} />
            </View>
            <Text style={s.heroAmount}>
              {fmt(typeof currentAmountNumber === "number" ? currentAmountNumber : 0, settings?.currency ?? undefined)}
            </Text>
            <Text style={s.heroSubtext}>
              Target {fmt(typeof targetAmountNumber === "number" ? targetAmountNumber : 0, settings?.currency ?? undefined)}
            </Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.sectionTitle}>Goal details</Text>

            <Text style={s.inputLabel}>Goal name</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Goal name"
              placeholderTextColor={T.textMuted}
              style={s.input}
              editable={!saving && !deleting}
            />

            <Text style={s.inputLabel}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional notes"
              placeholderTextColor={T.textMuted}
              style={[s.input, s.inputMultiline]}
              editable={!saving && !deleting}
              multiline
              textAlignVertical="top"
            />

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Target amount</Text>
                <MoneyInput
                  currency={settings?.currency}
                  value={targetAmount}
                  onChangeValue={setTargetAmount}
                  placeholder="e.g. 10000"
                  editable={!saving && !deleting}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Current progress</Text>
                <View style={s.readOnlyValueCard}>
                  <Text style={s.readOnlyValueText}>
                    {fmt(currentAmountNumber, settings?.currency ?? undefined)}
                  </Text>
                  <Text style={s.readOnlyValueHint}>Linked to settings balances and monthly allocations</Text>
                </View>
              </View>
            </View>

            <Text style={s.inputLabel}>Target year</Text>
            <TextInput
              value={targetYear}
              onChangeText={setTargetYear}
              placeholder="e.g. 2030"
              placeholderTextColor={T.textMuted}
              style={s.input}
              keyboardType="number-pad"
              editable={!saving && !deleting}
            />
          </View>

          <Pressable
            onPress={() => setShowOnHome((prev) => !prev)}
            disabled={saving || deleting}
            style={({ pressed }) => [s.card, s.toggleCard, pressed && s.cardPressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>Show on Home</Text>
              <Text style={s.toggleDescription}>{showOnHome ? "Remove this goal from the Home dashboard summary." : "Pin this goal to the Home dashboard summary."}</Text>
            </View>
            <View style={[s.toggleBadge, showOnHome && s.toggleBadgeActive]}>
              <Text style={[s.toggleBadgeText, showOnHome && s.toggleBadgeTextActive]}>{showOnHome ? "Remove" : "Add"}</Text>
            </View>
          </Pressable>
        </ScrollView>

        <View style={s.bottomActionsWrap}>
          <View style={s.bottomActionsRow}>
            <Pressable
              style={[s.bottomActionBtn, s.bottomActionBtnDelete, deleting && s.disabled]}
              onPress={() => setDeleteConfirmOpen(true)}
              disabled={saving || deleting}
            >
              {deleting ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.bottomActionDeleteText}>Delete</Text>}
            </Pressable>
            <Pressable
              style={[s.bottomActionBtn, s.bottomActionBtnSave, (!isDirty || saving) && s.disabled]}
              onPress={() => void handleSave()}
              disabled={!isDirty || saving || deleting}
            >
              {saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.bottomActionSaveText}>Save changes</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <DeleteConfirmSheet
        visible={deleteConfirmOpen}
        title="Delete Goal"
        description={`Are you sure you want to delete "${goal.title}"? This cannot be undone.`}
        isBusy={deleting}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20 },
  info: { color: T.textDim, fontSize: 14, fontWeight: "600" },
  error: { color: T.red, textAlign: "center", fontSize: 14, fontWeight: "600" },
  retryBtn: { marginTop: 8, backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "800" },
  heroCard: {
    ...cardElevated,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  heroTitle: {
    color: T.text,
    fontSize: 18,
    fontWeight: "900",
    flex: 1,
    marginRight: 10,
  },
  heroAmount: {
    color: T.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroSubtext: {
    marginTop: 4,
    color: T.textDim,
    fontSize: 13,
    fontWeight: "700",
  },
  card: {
    ...cardElevated,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardPressed: {
    opacity: 0.96,
  },
  sectionTitle: {
    color: T.text,
    fontSize: 15,
    fontWeight: "900",
  },
  inputLabel: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 6,
  },
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
  inputMultiline: {
    minHeight: 92,
  },
  readOnlyValueCard: {
    backgroundColor: T.cardAlt,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 50,
    justifyContent: "center",
  },
  readOnlyValueText: {
    color: T.text,
    fontSize: 14,
    fontWeight: "800",
  },
  readOnlyValueHint: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  row2: {
    flexDirection: "row",
    gap: 10,
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: T.border,
    overflow: "hidden",
    marginTop: 16,
  },
  progressFill: {
    height: 12,
    borderRadius: 999,
    backgroundColor: T.accent,
  },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleDescription: {
    ...textLabel,
    marginTop: 6,
    lineHeight: 18,
  },
  toggleBadge: {
    minWidth: 72,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: T.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  toggleBadgeText: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleBadgeActive: {
    backgroundColor: T.accent,
    borderColor: T.accentBorder,
  },
  toggleBadgeTextActive: {
    color: T.onAccent,
  },
  bottomActionsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 10,
    backgroundColor: T.bg,
  },
  bottomActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  bottomActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bottomActionBtnDelete: {
    backgroundColor: T.accentDim,
    borderColor: T.accentBorder,
  },
  bottomActionBtnSave: {
    backgroundColor: T.accent,
    borderColor: T.accentBorder,
  },
  bottomActionDeleteText: {
    color: T.red,
    fontSize: 14,
    fontWeight: "900",
  },
  bottomActionSaveText: {
    color: T.onAccent,
    fontSize: 14,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
});