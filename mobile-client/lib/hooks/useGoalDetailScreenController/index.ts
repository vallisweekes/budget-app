import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import type { Goal, Settings } from "@/lib/apiTypes";
import { asMoneyText, mapSavingsFieldToBalanceField, resolveGoalCurrentAmount } from "@/lib/helpers/settings";
import { getEffectiveHomepageGoals } from "@/components/DashboardScreen/derived";
import type { RootStackParamList } from "@/navigation/types";
import {
  getMobileApiErrorMessage,
  useDeleteGoalMutation,
  useLazyGetGoalQuery,
  useUpdateGoalMutation,
  useUpdateSettingsMutation,
} from "@/store/api";

type LinkedGoalField = "savings" | "emergency" | "investment";

function resolveLinkedGoalField(category: unknown): LinkedGoalField | null {
  const normalized = String(category ?? "").trim().toLowerCase();
  if (normalized === "savings" || normalized === "emergency" || normalized === "investment") {
    return normalized;
  }
  return null;
}

function getLinkedGoalAmountLabel(field: LinkedGoalField | null): string {
  if (field === "savings") return "Current savings";
  if (field === "emergency") return "Current emergency funds";
  if (field === "investment") return "Current investments";
  return "Current progress";
}

function getLinkedGoalAmountHint(field: LinkedGoalField | null): string {
  if (!field) {
    return "Linked to settings balances and monthly allocations";
  }
  return "Saves to Money settings so linked balances and sacrifices stay in sync.";
}

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
  const [fetchGoal] = useLazyGetGoalQuery();
  const [updateGoal] = useUpdateGoalMutation();
  const [deleteGoal] = useDeleteGoalMutation();
  const [updateSettings] = useUpdateSettingsMutation();

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
  const [currentAmountDraft, setCurrentAmountDraft] = useState("");
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
    const nextCategory = String(nextGoal.category ?? "").trim().toLowerCase();
    const nextCurrentAmount = resolveGoalCurrentAmount(nextCategory, nextGoal.currentAmount, nextSettings);
    setGoal(nextGoal);
    setTitle(String(nextGoal.title ?? ""));
    setDescription(String(nextGoal.description ?? ""));
    setTargetAmount(nextGoal.targetAmount ? String(nextGoal.targetAmount) : "");
    setTargetYear(nextGoal.targetYear ? String(nextGoal.targetYear) : "");
    setCurrentAmountDraft(asMoneyText(nextCurrentAmount));
    setShowOnHome(nextEffectiveHomepageGoalIds.has(nextGoal.id));
  }, [dashboard?.goals]);

  const load = useCallback(async (options?: { force?: boolean }) => {
    try {
      setError(null);
      if (options?.force) setRefreshing(true);

      const [{ settings: nextSettings }, nextGoal] = await Promise.all([
        options?.force ? refreshBootstrap({ force: true }) : ensureLoaded(),
        fetchGoal(params.goalId).unwrap(),
      ]);

      populateForm(nextGoal, nextSettings);
    } catch (err: unknown) {
      setError(getMobileApiErrorMessage(err, "Failed to load goal"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ensureLoaded, fetchGoal, params.goalId, populateForm, refreshBootstrap]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const isDirty = useMemo(() => {
    if (!goal) return false;
    const linkedGoalField = resolveLinkedGoalField(goal.category);
    const currentDescription = goal.description ?? "";
    const currentTargetAmount = goal.targetAmount ? String(goal.targetAmount) : "";
    const currentTargetYear = goal.targetYear ? String(goal.targetYear) : "";
    const currentShowOnHome = effectiveHomepageGoalIds.has(goal.id);
    const currentAmountSource = resolveGoalCurrentAmount(goal.category, goal.currentAmount, settings);
    const currentAmountParsed = parseAmount(currentAmountDraft);
    const currentAmountValue = linkedGoalField
      ? (typeof currentAmountParsed === "number" ? currentAmountParsed : 0)
      : currentAmountSource;
    const currentAmountChanged = linkedGoalField
      ? Math.abs(currentAmountValue - currentAmountSource) > 0.0001
      : false;
    return title.trim() !== goal.title
      || description.trim() !== currentDescription
      || targetAmount.trim() !== currentTargetAmount
      || targetYear.trim() !== currentTargetYear
      || showOnHome !== currentShowOnHome
      || currentAmountChanged;
  }, [currentAmountDraft, description, effectiveHomepageGoalIds, goal, settings, showOnHome, targetAmount, targetYear, title]);

  const handleSave = useCallback(async () => {
    if (!goal) return;

    const linkedGoalField = resolveLinkedGoalField(goal.category);
    const linkedBalanceField = linkedGoalField ? mapSavingsFieldToBalanceField(linkedGoalField) : null;

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
    if (linkedBalanceField && !budgetPlanId) {
      Alert.alert("Settings unavailable", "Please reopen this goal and try again.");
      return;
    }

    let nextCurrentAmount = 0;
    if (linkedBalanceField) {
      const parsedCurrentAmount = parseAmount(currentAmountDraft);
      if (typeof parsedCurrentAmount === "undefined") {
        Alert.alert("Invalid current amount", "Please enter a valid current amount.");
        return;
      }
      nextCurrentAmount = parsedCurrentAmount ?? 0;
    }

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
      await updateGoal({
        id: goal.id,
        changes: {
          title: nextTitle,
          description: description.trim() ? description.trim() : null,
          targetAmount: nextTargetAmount,
          targetYear: nextTargetYear,
        },
      }).unwrap();

      if (budgetPlanId) {
        const settingsChanges: Record<string, unknown> = {
          homepageGoalIds: nextHomepageGoalIds,
        };
        if (linkedBalanceField) {
          settingsChanges[linkedBalanceField] = nextCurrentAmount;
        }
        await updateSettings({ budgetPlanId, changes: settingsChanges }).unwrap();
      }

      await refreshBootstrap({ force: true });
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Failed to save goal", getMobileApiErrorMessage(err, "Unknown error"));
    } finally {
      setSaving(false);
    }
  }, [currentAmountDraft, dashboard?.budgetPlanId, dashboard?.goals, description, effectiveHomepageGoals, goal, navigation, refreshBootstrap, showOnHome, targetAmount, targetYear, title, updateGoal, updateSettings]);

  const handleDelete = useCallback(async () => {
    if (!goal) return;
    setDeleting(true);
    try {
      const budgetPlanId = dashboard?.budgetPlanId ?? goal.budgetPlanId ?? null;
      const currentHomepageGoalIds = Array.isArray(settings?.homepageGoalIds) ? settings.homepageGoalIds : [];
      await deleteGoal({ id: goal.id }).unwrap();
      if (budgetPlanId && currentHomepageGoalIds.includes(goal.id)) {
        await updateSettings({
          budgetPlanId,
          changes: {
            homepageGoalIds: currentHomepageGoalIds.filter((id) => id !== goal.id),
          },
        }).unwrap();
      }
      await refreshBootstrap({ force: true });
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Failed to delete goal", getMobileApiErrorMessage(err, "Unknown error"));
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }, [dashboard?.budgetPlanId, deleteGoal, goal, navigation, refreshBootstrap, settings?.homepageGoalIds, updateSettings]);

  const targetAmountNumber = parseAmount(targetAmount);
  const linkedGoalField = resolveLinkedGoalField(goal?.category);
  const category = String(goal?.category ?? "").trim().toLowerCase();
  const currentAmountSourceNumber = resolveGoalCurrentAmount(category, goal?.currentAmount, settings);
  const currentAmountParsed = parseAmount(currentAmountDraft);
  const currentAmountNumber = linkedGoalField
    ? (typeof currentAmountParsed === "number" ? currentAmountParsed : 0)
    : currentAmountSourceNumber;
  const progress = goal && typeof targetAmountNumber === "number" && targetAmountNumber > 0 && typeof currentAmountNumber === "number"
    ? Math.max(0, Math.min(1, currentAmountNumber / targetAmountNumber))
    : 0;

  return {
    currentAmountDraft,
    currentAmountEditable: Boolean(linkedGoalField),
    currentAmountHint: getLinkedGoalAmountHint(linkedGoalField),
    currentAmountLabel: getLinkedGoalAmountLabel(linkedGoalField),
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
    setCurrentAmountDraft,
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