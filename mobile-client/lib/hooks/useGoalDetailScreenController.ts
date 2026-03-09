import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { apiFetch } from "@/lib/api";
import type { Goal, Settings } from "@/lib/apiTypes";
import { resolveGoalCurrentAmount } from "@/lib/helpers/settings";
import { getEffectiveHomepageGoals } from "@/components/DashboardScreen/derived";
import type { RootStackParamList } from "@/navigation/types";

type GoalDetailRoute = RouteProp<RootStackParamList, "GoalDetail">;
type GoalDetailNav = NativeStackNavigationProp<RootStackParamList, "GoalDetail">;

function parseAmount(raw: string): number | null | undefined {
  const trimmed = String(raw ?? "").trim().replace(/,/g, "");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100) / 100;
}

function parseYear(raw: string): number | null | undefined {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  const year = Math.floor(parsed);
  if (year < 1900 || year > 3000) return undefined;
  return year;
}

export function useGoalDetailScreenController(params: GoalDetailRoute["params"]) {
  const navigation = useNavigation<GoalDetailNav>();
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
  }, [dashboard?.budgetPlanId, dashboard?.goals, description, effectiveHomepageGoals, goal, navigation, refreshBootstrap, showOnHome, targetAmount, targetYear, title]);

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

  return {
    currentAmountNumber,
    deleteConfirmOpen,
    deleting,
    description,
    error,
    goal,
    handleDelete,
    handleSave,
    isDirty,
    load,
    loading,
    progress,
    refreshing,
    saving,
    setDeleteConfirmOpen,
    setDescription,
    setShowOnHome,
    setTargetAmount,
    setTargetYear,
    setTitle,
    settings,
    showOnHome,
    targetAmount,
    targetAmountNumber,
    targetYear,
    title,
  };
}