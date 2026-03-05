import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { apiFetch } from "@/lib/api";
import type { Income, Settings, IncomeMonthData, IncomeSacrificeData, IncomeSacrificeFixed, IncomeSummaryData } from "@/lib/apiTypes";
import type { IncomeStackParamList } from "@/navigation/types";
import { currencySymbol, fmt, MONTH_NAMES_LONG } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { buildPayPeriodFromMonthAnchor, normalizePayFrequency } from "@/lib/payPeriods";
import { T } from "@/lib/theme";
import { useIncomeCRUD } from "@/lib/hooks/useIncomeCRUD";
import IncomeMonthHeader from "@/components/Income/IncomeMonthHeader";
import IncomeMonthIncomeList from "@/components/Income/IncomeMonthIncomeList";
import IncomeMonthSacrificeList from "@/components/Income/IncomeMonthSacrificeList";
import IncomeEditSheet from "@/components/Income/IncomeEditSheet";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import { s } from "./incomeMonthScreenStyles";

type Props = NativeStackScreenProps<IncomeStackParamList, "IncomeMonth">;

type MonthRef = { month: number; year: number };
type IncomeMutationMeta =
  | {
      type: "add";
      month: number;
      year: number;
      distributeMonths: boolean;
      distributeYears: boolean;
    }
  | {
      type: "edit" | "delete";
      month: number;
      year: number;
    };

export default function IncomeMonthScreen({ navigation, route }: Props) {
  const topHeaderOffset = useTopHeaderOffset(-32);
  const { month, year, budgetPlanId, initialMode, pendingConfirmationsCount, showPendingNotice, openIncomeAddAt } = route.params;

  const [analysis, setAnalysis] = useState<IncomeMonthData | null>(null);
  const [items, setItems]       = useState<Income[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Income | null>(null);
  const [viewMode, setViewMode] = useState<"income" | "sacrifice">(initialMode ?? "income");
  const [sacrifice, setSacrifice] = useState<IncomeSacrificeData | null>(null);
  const [sacrificeSaving, setSacrificeSaving] = useState(false);
  const [sacrificeCreating, setSacrificeCreating] = useState(false);
  const [sacrificeDeletingId, setSacrificeDeletingId] = useState<string | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);
  const [confirmingTargetKey, setConfirmingTargetKey] = useState<string | null>(null);
  const [pendingNoticeVisible, setPendingNoticeVisible] = useState(false);

  const analysisCacheRef = useRef<Record<string, Record<number, Record<number, IncomeMonthData>>>>({});
  const itemsCacheRef = useRef<Record<string, Record<number, Record<number, Income[]>>>>({});
  const sacrificeCacheRef = useRef<Record<string, Record<number, Record<number, IncomeSacrificeData>>>>({});
  const settingsCacheRef = useRef<Record<string, Settings>>({});
  const yearPrefetchStateRef = useRef<Record<string, "idle" | "loading" | "loaded">>({});

  const periodRange = useMemo(() => {
    const payFrequency = normalizePayFrequency(settings?.payFrequency);
    return buildPayPeriodFromMonthAnchor({
      year,
      month,
      payDate: settings?.payDate ?? 27,
      payFrequency,
    });
  }, [month, settings?.payDate, settings?.payFrequency, year]);

  const periodEndAt = useMemo(() => {
    const end = new Date(periodRange.end.getTime());
    end.setHours(23, 59, 59, 999);
    return end;
  }, [periodRange.end]);

  const sacrificeManageUntil = useMemo(() => {
    const cutoff = new Date(periodEndAt.getTime());
    cutoff.setDate(cutoff.getDate() + 5);
    cutoff.setHours(23, 59, 59, 999);
    return cutoff;
  }, [periodEndAt]);

  const isLocked = Date.now() > periodEndAt.getTime();
  const canManageSacrifice = Date.now() <= sacrificeManageUntil.getTime();

  const manageSacrificeNotice = useMemo(() => {
    if (canManageSacrifice) return undefined;
    return `Manage sacrifice closed on ${sacrificeManageUntil.toLocaleDateString("en-GB")} (5 days after this period ended).`;
  }, [canManageSacrifice, sacrificeManageUntil]);

  const monthLabel = useMemo(() => {
    const fallback = `${MONTH_NAMES_LONG[month - 1]} ${year}`;
    if (!settings) return fallback;

    const payFrequency = normalizePayFrequency(settings.payFrequency);
    const period = buildPayPeriodFromMonthAnchor({
      year,
      month,
      payDate: settings.payDate ?? 27,
      payFrequency,
    });
    const startLabel = MONTH_NAMES_LONG[period.start.getMonth()];
    const endLabel = MONTH_NAMES_LONG[period.end.getMonth()];
    if (!startLabel || !endLabel) return fallback;

    return `${startLabel} - ${endLabel} ${period.end.getFullYear()}`;
  }, [month, settings, year]);

  const currency = currencySymbol(settings?.currency);
  const planCacheKey = budgetPlanId || "none";

  const toIncomeItems = useCallback((summary: Array<{ id: string; name: string; amount: number }>, targetMonth: number, targetYear: number): Income[] => {
    return summary.map((item) => ({
      id: item.id,
      name: item.name,
      amount: String(item.amount ?? 0),
      month: targetMonth,
      year: targetYear,
      budgetPlanId,
    }));
  }, [budgetPlanId]);

  const getCachedAnalysis = useCallback((targetYear: number, targetMonth: number) => {
    return analysisCacheRef.current[planCacheKey]?.[targetYear]?.[targetMonth] ?? null;
  }, [planCacheKey]);

  const getCachedItems = useCallback((targetYear: number, targetMonth: number) => {
    return itemsCacheRef.current[planCacheKey]?.[targetYear]?.[targetMonth] ?? null;
  }, [planCacheKey]);

  const setCachedAnalysis = useCallback((targetYear: number, targetMonth: number, data: IncomeMonthData) => {
    if (!analysisCacheRef.current[planCacheKey]) analysisCacheRef.current[planCacheKey] = {};
    if (!analysisCacheRef.current[planCacheKey][targetYear]) analysisCacheRef.current[planCacheKey][targetYear] = {};
    analysisCacheRef.current[planCacheKey][targetYear][targetMonth] = data;
  }, [planCacheKey]);

  const setCachedItems = useCallback((targetYear: number, targetMonth: number, data: Income[]) => {
    if (!itemsCacheRef.current[planCacheKey]) itemsCacheRef.current[planCacheKey] = {};
    if (!itemsCacheRef.current[planCacheKey][targetYear]) itemsCacheRef.current[planCacheKey][targetYear] = {};
    itemsCacheRef.current[planCacheKey][targetYear][targetMonth] = data;
  }, [planCacheKey]);

  const invalidateMonthCaches = useCallback((targets: MonthRef[], options?: { analysis?: boolean; items?: boolean; sacrifice?: boolean }) => {
    const { analysis: dropAnalysis = true, items: dropItems = true, sacrifice: dropSacrifice = true } = options ?? {};
    const analysisPlanBucket = analysisCacheRef.current[planCacheKey] ?? {};
    const itemsPlanBucket = itemsCacheRef.current[planCacheKey] ?? {};
    const sacrificePlanBucket = sacrificeCacheRef.current[planCacheKey] ?? {};

    for (const target of targets) {
      if (dropAnalysis && analysisPlanBucket[target.year]) {
        delete analysisPlanBucket[target.year][target.month];
      }
      if (dropItems && itemsPlanBucket[target.year]) {
        delete itemsPlanBucket[target.year][target.month];
      }
      if (dropSacrifice && sacrificePlanBucket[target.year]) {
        delete sacrificePlanBucket[target.year][target.month];
      }
      yearPrefetchStateRef.current[`${planCacheKey}:${target.year}`] = "idle";
    }
    analysisCacheRef.current[planCacheKey] = analysisPlanBucket;
    itemsCacheRef.current[planCacheKey] = itemsPlanBucket;
    sacrificeCacheRef.current[planCacheKey] = sacrificePlanBucket;
  }, [planCacheKey]);

  const getAffectedMonthsForIncomeMutation = useCallback((meta: IncomeMutationMeta): MonthRef[] => {
    if (meta.type !== "add") {
      return [{ month: meta.month, year: meta.year }];
    }

    if (!meta.distributeMonths && !meta.distributeYears) {
      return [{ month: meta.month, year: meta.year }];
    }

    const cachedYears = new Set<number>([
      ...Object.keys(analysisCacheRef.current[planCacheKey] ?? {}).map((value) => Number(value)).filter((value) => Number.isFinite(value)),
      ...Object.keys(itemsCacheRef.current[planCacheKey] ?? {}).map((value) => Number(value)).filter((value) => Number.isFinite(value)),
      meta.year,
    ]);

    const targets: MonthRef[] = [];
    for (const cachedYear of cachedYears) {
      if (meta.distributeYears) {
        if (cachedYear < meta.year) continue;
        const monthStart = cachedYear === meta.year ? meta.month : 1;
        for (let monthIndex = monthStart; monthIndex <= 12; monthIndex += 1) {
          targets.push({ month: monthIndex, year: cachedYear });
        }
        continue;
      }

      if (cachedYear !== meta.year) continue;
      for (let monthIndex = meta.month; monthIndex <= 12; monthIndex += 1) {
        targets.push({ month: monthIndex, year: cachedYear });
      }
    }

    return targets.length ? targets : [{ month: meta.month, year: meta.year }];
  }, [planCacheKey]);

  const handleIncomeMutationSuccess = useCallback((meta: IncomeMutationMeta) => {
    const affected = getAffectedMonthsForIncomeMutation(meta);
    invalidateMonthCaches(affected, { analysis: true, items: true, sacrifice: false });
  }, [getAffectedMonthsForIncomeMutation, invalidateMonthCaches]);

  const loadSettings = useCallback(async () => {
    const cached = settingsCacheRef.current[budgetPlanId];
    if (cached) {
      setSettings(cached);
      return;
    }
    const next = await apiFetch<Settings>(`/api/bff/settings?budgetPlanId=${encodeURIComponent(budgetPlanId)}`);
    settingsCacheRef.current[budgetPlanId] = next;
    setSettings(next);
  }, [budgetPlanId]);

  const preloadYear = useCallback(async (targetYear: number) => {
    const stateKey = `${planCacheKey}:${targetYear}`;
    const state = yearPrefetchStateRef.current[stateKey] ?? "idle";
    if (state === "loading" || state === "loaded") return;

    yearPrefetchStateRef.current[stateKey] = "loading";
    try {
      const summary = await apiFetch<IncomeSummaryData>(`/api/bff/income-summary?year=${targetYear}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`);
      const summaryByMonth = new Map((summary.months ?? []).map((entry) => [entry.monthIndex, entry.items ?? []]));

      for (let monthIndex = 1; monthIndex <= 12; monthIndex += 1) {
        const summaryItems = summaryByMonth.get(monthIndex) ?? [];
        setCachedItems(targetYear, monthIndex, toIncomeItems(summaryItems, monthIndex, targetYear));
      }

      const monthRequests = Array.from({ length: 12 }, (_, idx) => idx + 1).map(async (monthIndex) => {
        const monthData = await apiFetch<IncomeMonthData>(
          `/api/bff/income-month?month=${monthIndex}&year=${targetYear}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`
        );
        setCachedAnalysis(targetYear, monthIndex, monthData);
      });

      await Promise.allSettled(monthRequests);
      yearPrefetchStateRef.current[stateKey] = "loaded";
    } catch {
      yearPrefetchStateRef.current[stateKey] = "idle";
    }
  }, [budgetPlanId, planCacheKey, setCachedAnalysis, setCachedItems, toIncomeItems]);

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    try {
      setError(null);

      if (!force) {
        const cachedMonthData = getCachedAnalysis(year, month);
        const cachedIncome = getCachedItems(year, month);
        if (cachedMonthData && cachedIncome) {
          setAnalysis(cachedMonthData);
          setItems(cachedIncome);
          setLoading(false);
          setRefreshing(false);
          void preloadYear(year);
          return;
        }
      }

      const [monthData, incomeList] = await Promise.all([
        apiFetch<IncomeMonthData>(`/api/bff/income-month?month=${month}&year=${year}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`),
        apiFetch<Income[]>(`/api/bff/income?month=${month}&year=${year}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`),
      ]);
      const normalizedIncome = Array.isArray(incomeList) ? incomeList : [];
      setAnalysis(monthData);
      setItems(normalizedIncome);
      setCachedAnalysis(year, month, monthData);
      setCachedItems(year, month, normalizedIncome);
      void preloadYear(year);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year, budgetPlanId, getCachedAnalysis, getCachedItems, preloadYear, setCachedAnalysis, setCachedItems]);

  const loadSacrifice = useCallback(async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    if (!force) {
      const cached = sacrificeCacheRef.current[planCacheKey]?.[year]?.[month] ?? null;
      if (cached) {
        setSacrifice(cached);
        return;
      }
    }
    const data = await apiFetch<IncomeSacrificeData>(
      `/api/bff/income-sacrifice?month=${month}&year=${year}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`
    );
    if (!sacrificeCacheRef.current[planCacheKey]) sacrificeCacheRef.current[planCacheKey] = {};
    if (!sacrificeCacheRef.current[planCacheKey][year]) sacrificeCacheRef.current[planCacheKey][year] = {};
    sacrificeCacheRef.current[planCacheKey][year][month] = data;
    setSacrifice(data);
  }, [month, year, budgetPlanId, planCacheKey]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    void load();
    loadSacrifice().catch(() => null);
  }, [load, loadSacrifice]);

  useEffect(() => {
    void preloadYear(year);
  }, [preloadYear, year]);

  useFocusEffect(
    useCallback(() => {
      void load();
      loadSacrifice().catch(() => null);
    }, [load, loadSacrifice])
  );

  const crud = useIncomeCRUD({
    month,
    year,
    budgetPlanId,
    onReload: () => load({ force: true }),
    onMutationSuccess: handleIncomeMutationSuccess,
    setItems,
  });

  const editingItem = crud.editingId ? items.find((i) => i.id === crud.editingId) ?? null : null;

  useEffect(() => {
    if (!isLocked) return;
    if (crud.showAddForm) crud.setShowAddForm(false);
    if (crud.editingId) crud.cancelEdit();
  }, [crud, isLocked]);

  useEffect(() => {
    setViewMode(initialMode ?? "income");
  }, [initialMode, month, year]);

  useEffect(() => {
    setPendingNoticeVisible(Boolean(showPendingNotice));
  }, [showPendingNotice, month, year]);

  useEffect(() => {
    if (!openIncomeAddAt) return;
    if (!isLocked) {
      crud.setShowAddForm(true);
      setViewMode("income");
    }
    navigation.setParams({ openIncomeAddAt: undefined });
  }, [crud, isLocked, navigation, openIncomeAddAt]);

  type SacrificePeriod =
    | "this_month"
    | "next_six_months"
    | "remaining_months"
    | "two_years"
    | "five_years"
    | "ten_years";

  type FixedField = keyof IncomeSacrificeFixed;

  const buildTargetMonths = useCallback((startMonth: number, startYear: number, period: SacrificePeriod) => {
    const safeMonth = Math.max(1, Math.min(12, Math.floor(startMonth)));
    const safeYear = Math.max(2000, Math.floor(startYear));
    const targets: Array<{ month: number; year: number }> = [];

    const pushSequence = (count: number) => {
      for (let index = 0; index < count; index += 1) {
        const absolute = (safeMonth - 1) + index;
        const nextYear = safeYear + Math.floor(absolute / 12);
        const nextMonth = (absolute % 12) + 1;
        targets.push({ month: nextMonth, year: nextYear });
      }
    };

    if (period === "this_month") {
      pushSequence(1);
      return targets;
    }
    if (period === "next_six_months") {
      pushSequence(6);
      return targets;
    }
    if (period === "remaining_months") {
      pushSequence(12 - safeMonth + 1);
      return targets;
    }
    if (period === "two_years") {
      pushSequence(24);
      return targets;
    }
    if (period === "five_years") {
      pushSequence(60);
      return targets;
    }
    pushSequence(120);
    return targets;
  }, []);

  const applySacrificeAmount = useCallback(async (args: {
    targetType: "fixed" | "custom";
    fixedField?: FixedField;
    customAllocationId?: string;
    amount: number;
    startMonth: number;
    startYear: number;
    period: SacrificePeriod;
  }) => {
    if (!canManageSacrifice) {
      Alert.alert("Manage closed", "Income sacrifice can only be managed until 5 days after the period ends.");
      return;
    }

    const value = Number(args.amount);
    if (!Number.isFinite(value) || value < 0) {
      Alert.alert("Invalid amount", "Enter an amount greater than or equal to 0.");
      return;
    }

    if (args.targetType === "fixed" && !args.fixedField) {
      Alert.alert("Select sacrifice", "Pick a sacrifice type to update.");
      return;
    }
    if (args.targetType === "custom" && !args.customAllocationId) {
      Alert.alert("Select item", "Pick a custom sacrifice item to update.");
      return;
    }

    const targets = buildTargetMonths(args.startMonth, args.startYear, args.period);
    if (targets.length === 0) {
      Alert.alert("Invalid period", "No target months were generated.");
      return;
    }

    const affectsViewedMonth = targets.some((target) => target.month === month && target.year === year);
    const previousSacrifice = sacrifice;

    if (affectsViewedMonth && previousSacrifice) {
      const nextFixed: IncomeSacrificeFixed = {
        monthlyAllowance: Number(previousSacrifice.fixed.monthlyAllowance ?? 0),
        monthlySavingsContribution: Number(previousSacrifice.fixed.monthlySavingsContribution ?? 0),
        monthlyEmergencyContribution: Number(previousSacrifice.fixed.monthlyEmergencyContribution ?? 0),
        monthlyInvestmentContribution: Number(previousSacrifice.fixed.monthlyInvestmentContribution ?? 0),
      };

      let nextCustomItems = [...(previousSacrifice.customItems ?? [])];
      let nextCustomTotal = Number(previousSacrifice.customTotal ?? 0);

      if (args.targetType === "fixed") {
        nextFixed[args.fixedField as FixedField] = value;
      } else {
        const targetId = args.customAllocationId as string;
        nextCustomItems = nextCustomItems.map((item) => {
          if (item.id !== targetId) return item;
          const oldAmount = Number(item.amount ?? 0);
          const newAmount = value;
          nextCustomTotal += newAmount - oldAmount;
          return { ...item, amount: newAmount };
        });
      }

      const fixedTotal =
        Number(nextFixed.monthlyAllowance ?? 0) +
        Number(nextFixed.monthlySavingsContribution ?? 0) +
        Number(nextFixed.monthlyEmergencyContribution ?? 0) +
        Number(nextFixed.monthlyInvestmentContribution ?? 0);

      setSacrifice({
        ...previousSacrifice,
        fixed: nextFixed,
        customItems: nextCustomItems,
        customTotal: nextCustomTotal,
        totalSacrifice: fixedTotal + nextCustomTotal,
      });
    }

    try {
      setSacrificeSaving(true);
      for (const target of targets) {
        const snapshot = await apiFetch<IncomeSacrificeData>(
          `/api/bff/income-sacrifice?month=${target.month}&year=${target.year}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`
        );

        if (args.targetType === "fixed") {
          const nextFixed: IncomeSacrificeFixed = {
            monthlyAllowance: Number(snapshot.fixed.monthlyAllowance ?? 0),
            monthlySavingsContribution: Number(snapshot.fixed.monthlySavingsContribution ?? 0),
            monthlyEmergencyContribution: Number(snapshot.fixed.monthlyEmergencyContribution ?? 0),
            monthlyInvestmentContribution: Number(snapshot.fixed.monthlyInvestmentContribution ?? 0),
          };
          nextFixed[args.fixedField as FixedField] = value;

          await apiFetch("/api/bff/income-sacrifice", {
            method: "PATCH",
            body: {
              budgetPlanId,
              month: target.month,
              year: target.year,
              fixed: nextFixed,
            },
          });
        } else {
          await apiFetch("/api/bff/income-sacrifice", {
            method: "PATCH",
            body: {
              budgetPlanId,
              month: target.month,
              year: target.year,
              fixed: snapshot.fixed,
              customAmountById: {
                [args.customAllocationId as string]: value,
              },
            },
          });
        }
      }

      invalidateMonthCaches(targets, { analysis: true, items: false, sacrifice: true });
      await Promise.all([loadSacrifice({ force: true }), load({ force: true })]);
    } catch (error) {
      if (affectsViewedMonth && previousSacrifice) {
        setSacrifice(previousSacrifice);
      }
      Alert.alert("Could not save sacrifice", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSacrificeSaving(false);
    }
  }, [budgetPlanId, buildTargetMonths, canManageSacrifice, load, loadSacrifice, month, sacrifice, year]);

  const createSacrificeItem = useCallback(async (args: {
    type: "allowance" | "savings" | "emergency" | "investment" | "custom";
    name: string;
  }) => {
    if (!canManageSacrifice) {
      Alert.alert("Manage closed", "Income sacrifice can only be managed until 5 days after the period ends.");
      return;
    }

    const trimmedName = args.name.trim();
    if (args.type === "custom" && !trimmedName) {
      Alert.alert("Name required", "Custom sacrifice requires a name.");
      return;
    }

    try {
      setSacrificeCreating(true);
      await apiFetch("/api/bff/income-sacrifice/custom", {
        method: "POST",
        body: {
          budgetPlanId,
          month,
          year,
          type: args.type,
          name: trimmedName,
          amount: 0,
        },
      });
      invalidateMonthCaches([{ month, year }], { analysis: true, items: false, sacrifice: true });
      await Promise.all([loadSacrifice({ force: true }), load({ force: true })]);
    } finally {
      setSacrificeCreating(false);
    }
  }, [budgetPlanId, canManageSacrifice, load, loadSacrifice, month, year]);

  const deleteSacrificeItem = async (id: string) => {
    if (!canManageSacrifice) {
      Alert.alert("Manage closed", "Income sacrifice can only be managed until 5 days after the period ends.");
      return;
    }

    try {
      setSacrificeDeletingId(id);
      await apiFetch(`/api/bff/income-sacrifice/custom/${id}`, { method: "DELETE" });
      invalidateMonthCaches([{ month, year }], { analysis: true, items: false, sacrifice: true });
      await Promise.all([loadSacrifice({ force: true }), load({ force: true })]);
    } finally {
      setSacrificeDeletingId(null);
    }
  };

  const saveSacrificeGoalLink = useCallback(async (args: { targetKey: string; goalId: string | null }) => {
    if (!canManageSacrifice) {
      Alert.alert("Manage closed", "Income sacrifice can only be managed until 5 days after the period ends.");
      return;
    }

    if (!args.targetKey.trim()) {
      Alert.alert("Link target", "Pick a sacrifice target first.");
      return;
    }

    try {
      setLinkSaving(true);
      await apiFetch("/api/bff/income-sacrifice/goals", {
        method: "PATCH",
        body: {
          budgetPlanId,
          targetKey: args.targetKey,
          goalId: args.goalId,
        },
      });
      await loadSacrifice();
    } catch (error) {
      Alert.alert("Could not save link", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLinkSaving(false);
    }
  }, [budgetPlanId, canManageSacrifice, loadSacrifice]);

  const confirmSacrificeTransfer = useCallback(async (targetKey: string) => {
    if (!canManageSacrifice) {
      Alert.alert("Manage closed", "Income sacrifice can only be managed until 5 days after the period ends.");
      return;
    }

    if (!targetKey.trim()) return;

    try {
      setConfirmingTargetKey(targetKey);
      await apiFetch("/api/bff/income-sacrifice/goals", {
        method: "POST",
        body: {
          budgetPlanId,
          month,
          year,
          targetKey,
        },
      });
      invalidateMonthCaches([{ month, year }], { analysis: true, items: false, sacrifice: true });
      await Promise.all([loadSacrifice({ force: true }), load({ force: true })]);
      Alert.alert("Confirmed", "Transfer confirmed and goal progress updated.");
    } catch (error) {
      Alert.alert("Could not confirm", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setConfirmingTargetKey(null);
    }
  }, [budgetPlanId, canManageSacrifice, load, loadSacrifice, month, year]);

  if (loading) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={["bottom"]}>
        <View style={s.center}><ActivityIndicator size="large" color={T.accent} /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={["bottom"]}>
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={() => { void load({ force: true }); }} style={s.retryBtn}><Text style={s.retryTxt}>Retry</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
		<SafeAreaView style={[s.safe, { paddingTop: topHeaderOffset }]} edges={["bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <IncomeMonthHeader
          monthLabel={monthLabel}
          isLocked={isLocked}
          viewMode={viewMode}
          showAddForm={crud.showAddForm}
          hideNavTitleRow
          onBack={() => navigation.goBack()}
          onToggleAdd={() => {
            if (isLocked) return;
            crud.setShowAddForm((v) => !v);
          }}
          onSetMode={setViewMode}
        />

        {viewMode === "sacrifice" ? (
          <IncomeMonthSacrificeList
            currency={currency}
            month={month}
            year={year}
            sacrifice={sacrifice}
            canManage={canManageSacrifice}
            manageUnavailableReason={manageSacrificeNotice}
            sacrificeSaving={sacrificeSaving}
            sacrificeCreating={sacrificeCreating}
            sacrificeDeletingId={sacrificeDeletingId}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              Promise.all([load({ force: true }), loadSacrifice({ force: true })]).finally(() => setRefreshing(false));
            }}
            onApplySacrificeAmount={applySacrificeAmount}
            onDeleteCustom={deleteSacrificeItem}
            onCreateItem={createSacrificeItem}
            onSaveGoalLink={saveSacrificeGoalLink}
            onConfirmTransfer={confirmSacrificeTransfer}
            goalLinkSaving={linkSaving}
            confirmingTargetKey={confirmingTargetKey}
            pendingNoticeText={pendingNoticeVisible
              ? (Number.isFinite(Number(pendingConfirmationsCount)) && Number(pendingConfirmationsCount) > 0
                ? `You have ${Number(pendingConfirmationsCount)} pending transfer confirmation${Number(pendingConfirmationsCount) === 1 ? "" : "s"}. Confirm them to update linked goals.`
                : "Confirm your transferred sacrifices to update linked goals.")
              : undefined}
            onDismissPendingNotice={() => setPendingNoticeVisible(false)}
          />
        ) : (
          <IncomeMonthIncomeList
            items={items}
            analysis={analysis}
            currency={currency}
            isLocked={isLocked}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load({ force: true });
            }}
            crud={crud}
          />
        )}

        <IncomeEditSheet
          visible={crud.editingId !== null}
          name={crud.editName}
          amount={crud.editAmount}
          currency={currency}
          totalIncome={items.reduce((sum, i) => sum + parseFloat(String(i.amount || "0")), 0)}
          setName={crud.setEditName}
          setAmount={crud.setEditAmount}
          saving={crud.saving}
          isLocked={isLocked}
          onCancel={crud.cancelEdit}
          onSave={() => {
            if (isLocked) return;
            crud.handleSaveEdit();
          }}
          onDelete={() => {
            if (!editingItem) return;
            crud.cancelEdit();
            setDeleteTarget(editingItem);
          }}
        />

        <DeleteConfirmSheet
          visible={deleteTarget !== null}
          title="Delete income"
          description={deleteTarget ? `Remove "${deleteTarget.name}" (${fmt(deleteTarget.amount, currency)})?` : ""}
          isBusy={crud.deletingId === deleteTarget?.id}
          onClose={() => {
            if (crud.deletingId) return;
            setDeleteTarget(null);
          }}
          onConfirm={async () => {
            if (!deleteTarget) return;
            await crud.deleteIncome(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

