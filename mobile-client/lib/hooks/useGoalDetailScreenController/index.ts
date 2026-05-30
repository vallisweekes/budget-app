import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import type { Goal, Settings } from "@/lib/apiTypes";
import { asMoneyText, mapSavingsFieldToBalanceField, resolveGoalCurrentAmount } from "@/lib/helpers/settings";
import {
  canonicalizeGoalDescription,
  canonicalizeGoalTitle,
  translateAppText,
  translateGoalDescription,
  translateGoalTitle,
} from "@/lib/i18n";
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

function getLinkedGoalAmountLabel(field: LinkedGoalField | null, language: string | null | undefined): string {
  if (field === "savings") return translateAppText(language, "goals.detail.currentSavings");
  if (field === "emergency") return translateAppText(language, "goals.detail.currentEmergency");
  if (field === "investment") return translateAppText(language, "goals.detail.currentInvestments");
  return translateAppText(language, "goals.detail.currentProgress");
}

function getLinkedGoalAmountHint(field: LinkedGoalField | null, language: string | null | undefined): string {
  if (!field) {
    return translateAppText(language, "goals.detail.currentProgressHint");
  }
  return translateAppText(language, "goals.detail.currentProgressHintSavings");
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
    const language = nextSettings?.language;
    setGoal(nextGoal);
    setTitle(translateGoalTitle(nextGoal.title, language));
    setDescription(translateGoalDescription(nextGoal.description, language));
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
    const language = settings?.language;
    const linkedGoalField = resolveLinkedGoalField(goal.category);
    const currentTitle = translateGoalTitle(goal.title, language);
    const currentDescription = translateGoalDescription(goal.description, language);
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
    return title.trim() !== currentTitle
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
    const language = settings?.language;

    const nextTitle = title.trim();
    if (!nextTitle) {
      Alert.alert(
        translateAppText(language, "goals.alert.titleRequiredTitle"),
        translateAppText(language, "goals.alert.titleRequiredMessage"),
      );
      return;
    }

    const nextTargetAmount = parseAmount(targetAmount);
    if (typeof nextTargetAmount === "undefined") {
      Alert.alert(
        translateAppText(language, "goals.alert.invalidTargetAmountTitle"),
        translateAppText(language, "goals.alert.invalidTargetAmountMessage"),
      );
      return;
    }

    const nextTargetYear = parseYear(targetYear);
    if (typeof nextTargetYear === "undefined") {
      Alert.alert(
        translateAppText(language, "goals.alert.invalidTargetYearTitle"),
        translateAppText(language, "goals.alert.invalidTargetYearMessage"),
      );
      return;
    }

    const budgetPlanId = dashboard?.budgetPlanId ?? goal.budgetPlanId ?? null;
    if (linkedBalanceField && !budgetPlanId) {
      Alert.alert(
        translateAppText(language, "goals.error.settingsUnavailableTitle"),
        translateAppText(language, "goals.error.settingsUnavailableMessage"),
      );
      return;
    }

    let nextCurrentAmount = 0;
    if (linkedBalanceField) {
      const parsedCurrentAmount = parseAmount(currentAmountDraft);
      if (typeof parsedCurrentAmount === "undefined") {
        Alert.alert(
          translateAppText(language, "goals.alert.invalidCurrentAmountTitle"),
          translateAppText(language, "goals.alert.invalidCurrentAmountMessage"),
        );
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
      Alert.alert(
        translateAppText(language, "goals.error.homeLimitTitle"),
        translateAppText(language, "goals.error.homeLimitMessage"),
      );
      return;
    }

    setSaving(true);
    try {
      const canonicalTitle = canonicalizeGoalTitle(nextTitle, language);
      const canonicalDescription = canonicalizeGoalDescription(description.trim(), language);
      await updateGoal({
        id: goal.id,
        changes: {
          title: canonicalTitle,
          description: canonicalDescription ? canonicalDescription : null,
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
      Alert.alert(translateAppText(language, "goals.error.saveFailed"), getMobileApiErrorMessage(err, "Unknown error"));
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
      Alert.alert(translateAppText(settings?.language, "goals.error.deleteFailed"), getMobileApiErrorMessage(err, "Unknown error"));
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
    currentAmountHint: getLinkedGoalAmountHint(linkedGoalField, settings?.language),
    currentAmountLabel: getLinkedGoalAmountLabel(linkedGoalField, settings?.language),
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