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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { apiFetch, getApiMutationVersion } from "@/lib/api";
import type { Income, Settings, IncomeMonthData, IncomeSacrificeData, IncomeSacrificeFixed } from "@/lib/apiTypes";
import { computeMoneyLeftVsLastMonth } from "@/lib/domain/incomeStats";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useAppLocale, useIncomeCRUD, useSavingsPotStore, useTopHeaderOffset } from "@/hooks";
import { registerSessionScopedResetter } from "@/lib/sessionScopedState";
import { subscribeIncomeAddTrigger } from "@/lib/events/incomeAddTrigger";
import {
  buildPayPeriodFromMonthAnchor,
  getPayPeriodAnchorFromSelection,
  getPayPeriodAnchorFromWindow,
  getPayPeriodRangeLabelFromAnchor,
  normalizePayFrequency,
  resolveActivePayPeriod,
  resolveFirstSelectablePayPeriodWindow,
} from "@/lib/payPeriods";
import { T } from "@/lib/theme";
import IncomeMonthHeader from "@/components/Income/IncomeMonthHeader";
import IncomeMonthIncomeList from "@/components/Income/IncomeMonthIncomeList";
import IncomeMonthSacrificeList from "@/components/Income/IncomeMonthSacrificeList";
import IncomeEditSheet from "@/components/Income/IncomeEditSheet";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import TabRouteHeader from "@/navigation/TabRouteHeader";
import {
  getMobileApiErrorMessage,
  useConfirmIncomeSacrificeGoalTransferMutation,
  useCreateIncomeSacrificeCustomMutation,
  useDeleteIncomeSacrificeCustomMutation,
  useUpdateSettingsMutation,
  useUpdateIncomeSacrificeGoalLinkMutation,
  useUpdateIncomeSacrificeMutation,
} from "@/store/api";
import { s } from "./style";
import type { IncomeMonthScreenProps, IncomeMutationMeta, MonthRef } from "@/types";
import type { SavingsField, SavingsPot } from "@/types/settings";

type AnalysisCacheStore = Record<string, Record<number, Record<number, IncomeMonthData>>>;
type ItemsCacheStore = Record<string, Record<number, Record<number, Income[]>>>;
type SacrificeCacheStore = Record<string, Record<number, Record<number, IncomeSacrificeData>>>;
type SettingsCacheStore = Record<string, Settings>;
type MonthPrefetchStore = Record<string, "idle" | "loading" | "loaded">;
const SACRIFICE_SAVE_TIMEOUT_MS = 20_000;
const SACRIFICE_SAVE_CONCURRENCY = 6;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function normalizeSavingsPotBroker(value: unknown): string {
  if (typeof value !== "string") return "none";
  const normalized = value.trim();
  return normalized || "none";
}

const sharedAnalysisCache: AnalysisCacheStore = {};
const sharedItemsCache: ItemsCacheStore = {};
const sharedSacrificeCache: SacrificeCacheStore = {};
const sharedSettingsCache: SettingsCacheStore = {};
const sharedMonthPrefetchState: MonthPrefetchStore = {};

function resetSharedIncomeMonthState() {
  for (const key of Object.keys(sharedAnalysisCache)) delete sharedAnalysisCache[key];
  for (const key of Object.keys(sharedItemsCache)) delete sharedItemsCache[key];
  for (const key of Object.keys(sharedSacrificeCache)) delete sharedSacrificeCache[key];
  for (const key of Object.keys(sharedSettingsCache)) delete sharedSettingsCache[key];
  for (const key of Object.keys(sharedMonthPrefetchState)) delete sharedMonthPrefetchState[key];
}

registerSessionScopedResetter(resetSharedIncomeMonthState);

function getCachedAnalysisSnapshot(store: AnalysisCacheStore, planCacheKey: string, year: number, month: number): IncomeMonthData | null {
  return store[planCacheKey]?.[year]?.[month] ?? null;
}

function getCachedSacrificeSnapshot(store: SacrificeCacheStore, planCacheKey: string, year: number, month: number): IncomeSacrificeData | null {
  return store[planCacheKey]?.[year]?.[month] ?? null;
}

function toInitialIncomeItems(
  summary: Array<{ id: string; name: string; amount: number }> | undefined,
  targetMonth: number,
  targetYear: number,
  budgetPlanId: string,
): Income[] {
  return (summary ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    amount: String(item.amount ?? 0),
    month: targetMonth,
    year: targetYear,
    budgetPlanId,
  }));
}

export default function IncomeMonthScreen({ navigation, route }: IncomeMonthScreenProps) {
  const router = useRouter();
  const { formatDate, locale, monthNamesLong } = useAppLocale();
  const { readSavingsPotsForPlan, writeSavingsPotsForPlan, ensureSavingsPotAllocationLinks } = useSavingsPotStore();
  const [updateIncomeSacrifice] = useUpdateIncomeSacrificeMutation();
  const [createIncomeSacrificeCustom] = useCreateIncomeSacrificeCustomMutation();
  const [deleteIncomeSacrificeCustom] = useDeleteIncomeSacrificeCustomMutation();
  const [updateSettingsMutation] = useUpdateSettingsMutation();
  const [updateIncomeSacrificeGoalLink] = useUpdateIncomeSacrificeGoalLinkMutation();
  const [confirmIncomeSacrificeGoalTransfer] = useConfirmIncomeSacrificeGoalTransferMutation();
  const topHeaderOffset = useTopHeaderOffset(-32);
  const insets = useSafeAreaInsets();
  const { month, year, budgetPlanId, initialMode, pendingConfirmationsCount, showPendingNotice, openIncomeAddAt, standaloneSacrifice } = route.params;
  const planCacheKey = budgetPlanId || "none";
  const initialAnalysis = getCachedAnalysisSnapshot(sharedAnalysisCache, planCacheKey, year, month);
  const initialSacrifice = getCachedSacrificeSnapshot(sharedSacrificeCache, planCacheKey, year, month);
  const [headerHeight, setHeaderHeight] = useState(118);

  const [analysis, setAnalysis] = useState<IncomeMonthData | null>(initialAnalysis);
  const [items, setItems]       = useState<Income[]>(() => toInitialIncomeItems(initialAnalysis?.incomeItems, month, year, budgetPlanId));
  const [settings, setSettings] = useState<Settings | null>(() => sharedSettingsCache[budgetPlanId] ?? null);
  const [savingsPots, setSavingsPots] = useState<SavingsPot[]>([]);
  const [loading, setLoading]   = useState(() => {
    if (initialAnalysis) return false;
    if ((initialMode ?? "income") === "sacrifice" && initialSacrifice) return false;
    return true;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Income | null>(null);
  const [viewMode, setViewMode] = useState<"income" | "sacrifice">(initialMode ?? "income");
  const [sacrifice, setSacrifice] = useState<IncomeSacrificeData | null>(initialSacrifice);
  const [sacrificeSaving, setSacrificeSaving] = useState(false);
  const [sacrificeCreating, setSacrificeCreating] = useState(false);
  const [sacrificeDeletingId, setSacrificeDeletingId] = useState<string | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);
  const [confirmingTargetKey, setConfirmingTargetKey] = useState<string | null>(null);
  const [pendingNoticeVisible, setPendingNoticeVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isSacrificeManageActive, setIsSacrificeManageActive] = useState(false);
  const [sacrificeAddSheetToken, setSacrificeAddSheetToken] = useState(0);
  const isStandaloneSacrifice = standaloneSacrifice === true;
  const normalizedPayFrequency = useMemo(() => normalizePayFrequency(settings?.payFrequency), [settings?.payFrequency]);
  const normalizedPayAnchorDate = useMemo(
    () => (normalizedPayFrequency === "monthly" ? null : (settings?.payAnchorDate ?? null)),
    [normalizedPayFrequency, settings?.payAnchorDate],
  );

  const analysisCacheRef = useRef<AnalysisCacheStore>(sharedAnalysisCache);
  const itemsCacheRef = useRef<ItemsCacheStore>(sharedItemsCache);
  const sacrificeCacheRef = useRef<SacrificeCacheStore>(sharedSacrificeCache);
  const settingsCacheRef = useRef<SettingsCacheStore>(sharedSettingsCache);
  const monthPrefetchStateRef = useRef<MonthPrefetchStore>(sharedMonthPrefetchState);
  const seenMutationVersionRef = useRef<number>(getApiMutationVersion());

  const periodRange = useMemo(() => {
    return buildPayPeriodFromMonthAnchor({
      year,
      month,
      payDate: settings?.payDate ?? 27,
      payFrequency: normalizedPayFrequency,
      payAnchorDate: normalizedPayAnchorDate,
    });
  }, [month, normalizedPayAnchorDate, normalizedPayFrequency, settings?.payDate, year]);

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

  useEffect(() => {
    setCurrentTime(Date.now());
  }, [periodEndAt, sacrificeManageUntil]);

  const refreshSavingsPots = useCallback(async () => {
    try {
      const storedPots = await readSavingsPotsForPlan(budgetPlanId);
      const syncedPots = await ensureSavingsPotAllocationLinks(budgetPlanId, storedPots);
      setSavingsPots(syncedPots);
    } catch {
      setSavingsPots([]);
    }
  }, [budgetPlanId, ensureSavingsPotAllocationLinks, readSavingsPotsForPlan]);

  useEffect(() => {
    void refreshSavingsPots();
  }, [refreshSavingsPots]);

  const isLocked = currentTime > periodEndAt.getTime();
  const canManageSacrifice = currentTime <= sacrificeManageUntil.getTime();

  const manageSacrificeNotice = useMemo(() => {
    if (canManageSacrifice) return undefined;
    return `Manage sacrifice closed on ${formatDate(sacrificeManageUntil, { day: "numeric", month: "numeric", year: "numeric" })} (5 days after this period ended).`;
  }, [canManageSacrifice, formatDate, sacrificeManageUntil]);

  const monthLabel = useMemo(() => {
    const fallback = `${monthNamesLong[month - 1]} ${year}`;
    if (!settings) return fallback;

    return getPayPeriodRangeLabelFromAnchor({
      year,
      month,
      payDate: settings.payDate ?? 27,
      payFrequency: normalizedPayFrequency,
      payAnchorDate: normalizedPayAnchorDate,
      locale,
    });
  }, [locale, month, monthNamesLong, normalizedPayAnchorDate, normalizedPayFrequency, settings, year]);

  const currency = currencySymbol(settings?.currency);
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

  const optimisticAnalysis = useMemo(() => {
    if (!analysis) return null;

    const incomeItems = items.map((item) => ({
      id: item.id,
      name: item.name,
      amount: Number(item.amount ?? 0),
    }));
    const grossIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0);
    const delta = grossIncome - Number(analysis.grossIncome ?? 0);
    const moneyLeftAfterPlan = Number(analysis.moneyLeftAfterPlan ?? 0) + delta;
    const incomeLeftRightNow = Number(analysis.incomeLeftRightNow ?? 0) + delta;
    const spendableIncomeRightNow = Number(analysis.spendableIncomeRightNow ?? 0) + delta;
    const incomeSacrifice = Number(analysis.incomeSacrifice ?? 0);

    return {
      ...analysis,
      incomeItems,
      grossIncome,
      sourceCount: incomeItems.length,
      moneyLeftAfterPlan,
      incomeLeftRightNow,
      spendableIncomeRightNow,
      incomeSacrificePct: grossIncome > 0 ? (incomeSacrifice / grossIncome) * 100 : 0,
      moneyLeftPctOfGross: grossIncome > 0 ? (moneyLeftAfterPlan / grossIncome) * 100 : 0,
      moneyLeftVsLastMonthPct: computeMoneyLeftVsLastMonth(analysis.previousMoneyLeftAfterPlan, moneyLeftAfterPlan),
      planStatusTag: moneyLeftAfterPlan >= 0 ? "on_plan" : "over_plan",
      planStatusDescription: moneyLeftAfterPlan >= 0 ? "On plan" : "Over plan",
      isOnPlan: moneyLeftAfterPlan >= 0,
    } satisfies IncomeMonthData;
  }, [analysis, items]);

  const hydrateComparisonMetrics = useCallback((targetYear: number, targetMonth: number, data: IncomeMonthData): IncomeMonthData => {
    const previous = targetMonth === 1
      ? getCachedAnalysis(targetYear - 1, 12)
      : getCachedAnalysis(targetYear, targetMonth - 1);
    const previousMoneyLeftAfterPlan = previous?.moneyLeftAfterPlan;
    return {
      ...data,
      previousMoneyLeftAfterPlan,
      moneyLeftVsLastMonthPct: computeMoneyLeftVsLastMonth(previousMoneyLeftAfterPlan, data.moneyLeftAfterPlan),
    };
  }, [getCachedAnalysis]);

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

  const getMonthPrefetchKey = useCallback((targetYear: number, targetMonth: number) => {
    return `${planCacheKey}:${targetYear}:${targetMonth}`;
  }, [planCacheKey]);

  const invalidateMonthCaches = useCallback((targets: MonthRef[], options?: { analysis?: boolean; items?: boolean; sacrifice?: boolean }) => {
    const { analysis: dropAnalysis = true, items: dropItems = true, sacrifice: dropSacrifice = true } = options ?? {};
    const analysisPlanBucket = { ...(analysisCacheRef.current[planCacheKey] ?? {}) };
    const itemsPlanBucket = { ...(itemsCacheRef.current[planCacheKey] ?? {}) };
    const sacrificePlanBucket = { ...(sacrificeCacheRef.current[planCacheKey] ?? {}) };

    for (const target of targets) {
      if (dropAnalysis && analysisPlanBucket[target.year]) {
        analysisPlanBucket[target.year] = { ...analysisPlanBucket[target.year] };
        delete analysisPlanBucket[target.year][target.month];
      }
      if (dropItems && itemsPlanBucket[target.year]) {
        itemsPlanBucket[target.year] = { ...itemsPlanBucket[target.year] };
        delete itemsPlanBucket[target.year][target.month];
      }
      if (dropSacrifice && sacrificePlanBucket[target.year]) {
        sacrificePlanBucket[target.year] = { ...sacrificePlanBucket[target.year] };
        delete sacrificePlanBucket[target.year][target.month];
      }
      monthPrefetchStateRef.current[getMonthPrefetchKey(target.year, target.month)] = "idle";
    }
    analysisCacheRef.current[planCacheKey] = analysisPlanBucket;
    itemsCacheRef.current[planCacheKey] = itemsPlanBucket;
    sacrificeCacheRef.current[planCacheKey] = sacrificePlanBucket;
  }, [getMonthPrefetchKey, planCacheKey]);

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

  const getAdjacentMonths = useCallback((targetMonth: number, targetYear: number): MonthRef[] => {
    const previous = targetMonth === 1
      ? { month: 12, year: targetYear - 1 }
      : { month: targetMonth - 1, year: targetYear };
    const next = targetMonth === 12
      ? { month: 1, year: targetYear + 1 }
      : { month: targetMonth + 1, year: targetYear };
    return [previous, next];
  }, []);

  const planStartAt = useMemo(() => {
    const raw = settings?.setupCompletedAt ?? settings?.accountCreatedAt ?? null;
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }, [settings?.accountCreatedAt, settings?.setupCompletedAt]);

  const firstSelectablePeriod = useMemo(() => resolveFirstSelectablePayPeriodWindow({
    payDate: settings?.payDate ?? 27,
    payFrequency: normalizePayFrequency(settings?.payFrequency),
    payAnchorDate: normalizePayFrequency(settings?.payFrequency) === "monthly" ? null : (settings?.payAnchorDate ?? null),
    planStartAt,
  }), [planStartAt, settings?.payAnchorDate, settings?.payDate, settings?.payFrequency]);

  const canGoToPreviousPeriod = useMemo(() => {
    const previous = month === 1
      ? { month: 12, year: year - 1 }
      : { month: month - 1, year };

    const previousPeriod = buildPayPeriodFromMonthAnchor({
      year: previous.year,
      month: previous.month,
      payDate: settings?.payDate ?? 27,
      payFrequency: normalizePayFrequency(settings?.payFrequency),
      payAnchorDate: normalizePayFrequency(settings?.payFrequency) === "monthly" ? null : (settings?.payAnchorDate ?? null),
    });

    return previousPeriod.start.getTime() >= firstSelectablePeriod.start.getTime();
  }, [firstSelectablePeriod.start, month, settings?.payAnchorDate, settings?.payDate, settings?.payFrequency, year]);

  const handleGoToPreviousPeriod = useCallback(() => {
    if (!canGoToPreviousPeriod) return;

    const previous = month === 1
      ? { month: 12, year: year - 1 }
      : { month: month - 1, year };

    navigation.setParams({
      month: previous.month,
      year: previous.year,
      initialMode: viewMode,
      showPendingNotice: undefined,
      pendingConfirmationsCount: undefined,
      openIncomeAddAt: undefined,
    });
  }, [canGoToPreviousPeriod, month, navigation, viewMode, year]);

  const handleGoToNextPeriod = useCallback(() => {
    const next = month === 12
      ? { month: 1, year: year + 1 }
      : { month: month + 1, year };

    navigation.setParams({
      month: next.month,
      year: next.year,
      initialMode: viewMode,
      showPendingNotice: undefined,
      pendingConfirmationsCount: undefined,
      openIncomeAddAt: undefined,
    });
  }, [month, navigation, viewMode, year]);

  const handleGoToCurrentPeriod = useCallback(() => {
    const planCreatedAtRaw = settings?.accountCreatedAt ?? settings?.setupCompletedAt ?? null;
    const planCreatedAt = planCreatedAtRaw ? new Date(planCreatedAtRaw) : null;
    const currentPeriod = resolveActivePayPeriod({
      now: new Date(),
      payDate: settings?.payDate ?? 27,
      payFrequency: normalizedPayFrequency,
      payAnchorDate: normalizedPayAnchorDate,
      planCreatedAt: planCreatedAt && !Number.isNaN(planCreatedAt.getTime()) ? planCreatedAt : null,
    });
    const currentAnchor = getPayPeriodAnchorFromWindow({
      period: currentPeriod,
      payFrequency: normalizedPayFrequency,
    });

    navigation.setParams({
      month: currentAnchor.month,
      year: currentAnchor.year,
      initialMode: viewMode,
      showPendingNotice: undefined,
      pendingConfirmationsCount: undefined,
      openIncomeAddAt: undefined,
    });
  }, [navigation, normalizedPayAnchorDate, normalizedPayFrequency, settings?.accountCreatedAt, settings?.payDate, settings?.setupCompletedAt, viewMode]);

  const prefetchMonthAnalysis = useCallback(async (targetYear: number, targetMonth: number) => {
    if (getCachedAnalysis(targetYear, targetMonth)) return;
    const stateKey = getMonthPrefetchKey(targetYear, targetMonth);
    const state = monthPrefetchStateRef.current[stateKey] ?? "idle";
    if (state === "loading" || state === "loaded") return;

    monthPrefetchStateRef.current[stateKey] = "loading";
    try {
      const monthData = await apiFetch<IncomeMonthData>(
        `/api/bff/income-month?month=${targetMonth}&year=${targetYear}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`
      );
      const hydratedMonthData = hydrateComparisonMetrics(targetYear, targetMonth, monthData);
      setCachedAnalysis(targetYear, targetMonth, hydratedMonthData);
      setCachedItems(targetYear, targetMonth, toIncomeItems(hydratedMonthData.incomeItems ?? [], targetMonth, targetYear));

      const activePrevious = month === 1
        ? { month: 12, year: year - 1 }
        : { month: month - 1, year };
      if (targetYear === activePrevious.year && targetMonth === activePrevious.month) {
        const currentMonthData = getCachedAnalysis(year, month);
        if (currentMonthData) {
          const hydratedCurrent = hydrateComparisonMetrics(year, month, currentMonthData);
          setCachedAnalysis(year, month, hydratedCurrent);
          setAnalysis((current) => {
            if (!current || current.year !== year || current.month !== month) return current;
            return hydratedCurrent;
          });
        }
      }

      monthPrefetchStateRef.current[stateKey] = "loaded";
    } catch {
      monthPrefetchStateRef.current[stateKey] = "idle";
    }
  }, [budgetPlanId, getCachedAnalysis, getMonthPrefetchKey, hydrateComparisonMetrics, month, setCachedAnalysis, setCachedItems, toIncomeItems, year]);

  const prefetchAdjacentMonths = useCallback((targetYear: number, targetMonth: number) => {
    for (const target of getAdjacentMonths(targetMonth, targetYear)) {
      void prefetchMonthAnalysis(target.year, target.month);
    }
  }, [getAdjacentMonths, prefetchMonthAnalysis]);

  const loadSacrifice = useCallback(async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    if (!force) {
      const cached = sacrificeCacheRef.current[planCacheKey]?.[year]?.[month] ?? null;
      if (
        cached &&
        Array.isArray(cached.tips) &&
        cached.baseBalances &&
        typeof cached.baseBalances.savings === "number" &&
        typeof cached.baseBalances.emergency === "number" &&
        typeof cached.baseBalances.investment === "number"
      ) {
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

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    const shouldBlockOnSacrifice = viewMode === "sacrifice" || (initialMode ?? "income") === "sacrifice";
    try {
      setError(null);
      let hasCachedSnapshot = false;

      if (!force) {
        const cachedMonthData = getCachedAnalysis(year, month);
        if (cachedMonthData) {
          hasCachedSnapshot = true;
          setAnalysis(cachedMonthData);
          setItems(toIncomeItems(cachedMonthData.incomeItems ?? [], month, year));
          setLoading(false);
          setRefreshing(false);
          prefetchAdjacentMonths(year, month);
          void loadSacrifice().catch(() => null);
        }
      }

      const sacrificeWarmupPromise = loadSacrifice({ force }).catch(() => null);
      const monthData = await apiFetch<IncomeMonthData>(`/api/bff/income-month?month=${month}&year=${year}&budgetPlanId=${encodeURIComponent(budgetPlanId)}`);
      const hydratedMonthData = hydrateComparisonMetrics(year, month, monthData);
      const normalizedIncome = toIncomeItems(hydratedMonthData.incomeItems ?? [], month, year);
      setAnalysis(hydratedMonthData);
      setItems(normalizedIncome);
      setCachedAnalysis(year, month, hydratedMonthData);
      setCachedItems(year, month, normalizedIncome);
      prefetchAdjacentMonths(year, month);

      if (shouldBlockOnSacrifice) {
        await sacrificeWarmupPromise;
      }

      if (hasCachedSnapshot) {
        // Revalidated with fresh server data; keep UI state settled.
        setRefreshing(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    budgetPlanId,
    getCachedAnalysis,
    hydrateComparisonMetrics,
    initialMode,
    loadSacrifice,
    month,
    prefetchAdjacentMonths,
    setCachedAnalysis,
    setCachedItems,
    toIncomeItems,
    viewMode,
    year,
  ]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const latestMutationVersion = getApiMutationVersion();
      if (latestMutationVersion === seenMutationVersionRef.current) {
        return;
      }

      seenMutationVersionRef.current = latestMutationVersion;
      const targets = [{ month, year }, ...getAdjacentMonths(month, year)];
      invalidateMonthCaches(targets, { analysis: true, items: true, sacrifice: true });
      if (viewMode === "sacrifice") {
        void Promise.all([
          load({ force: true }),
          loadSacrifice({ force: true }),
          refreshSavingsPots(),
        ]);
        return;
      }
      void refreshSavingsPots();
      void load({ force: true });
    }, [getAdjacentMonths, invalidateMonthCaches, load, loadSacrifice, month, refreshSavingsPots, viewMode, year])
  );

  useEffect(() => {
    if (viewMode !== "sacrifice") return;
    // Always refresh sacrifice data on period/view switch so local cache cannot
    // keep showing a previous period snapshot after server logic changes.
    loadSacrifice({ force: true }).catch(() => null);
  }, [loadSacrifice, viewMode]);

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

  const openStandaloneSacrifice = useCallback(() => {
    void loadSacrifice().catch(() => null);
    setViewMode("sacrifice");
    navigation.setParams({
      initialMode: "sacrifice",
      pendingConfirmationsCount,
      showPendingNotice: pendingNoticeVisible,
      openIncomeAddAt: undefined,
    });
  }, [loadSacrifice, navigation, pendingConfirmationsCount, pendingNoticeVisible]);

  const returnToTabbedIncome = useCallback(() => {
    router.replace({
      pathname: "/(tabs)/income/IncomeMonth",
      params: {
        month,
        year,
        budgetPlanId,
        initialMode: "income",
      },
    });
  }, [budgetPlanId, month, router, year]);

  const returnToDashboard = useCallback(() => {
    router.replace({
      pathname: "/(tabs)/dashboard",
    });
  }, [router]);

  const handleSetViewMode = useCallback((mode: "income" | "sacrifice") => {
    if (mode === "sacrifice" && !isStandaloneSacrifice) {
      openStandaloneSacrifice();
      return;
    }

    if (mode === "income" && isStandaloneSacrifice) {
      returnToTabbedIncome();
      return;
    }

    setViewMode(mode);
    navigation.setParams({
      initialMode: mode,
      openIncomeAddAt: undefined,
    });
  }, [isStandaloneSacrifice, navigation, openStandaloneSacrifice, returnToTabbedIncome]);

  const handleBackPress = useCallback(() => {
    if (isStandaloneSacrifice && !navigation.canGoBack?.()) {
      returnToTabbedIncome();
      return;
    }
    navigation.goBack();
  }, [isStandaloneSacrifice, navigation, returnToTabbedIncome]);

  useEffect(() => {
    navigation.setParams({ sacrificeManageActive: isSacrificeManageActive });
  }, [isSacrificeManageActive, navigation]);

  useEffect(() => {
    if (!openIncomeAddAt) return;
    if (!isLocked) {
      crud.setShowAddForm(true);
      setViewMode("income");
    }
    navigation.setParams({ openIncomeAddAt: undefined });
  }, [crud, isLocked, navigation, openIncomeAddAt]);

  useEffect(() => {
    return subscribeIncomeAddTrigger(() => {
      if (!navigation.isFocused?.()) return;
      if (isLocked) return;

      if (viewMode === "sacrifice") {
        setSacrificeAddSheetToken((current) => current + 1);
        return;
      }

      crud.setShowAddForm(true);
      setViewMode("income");
    });
  }, [crud, isLocked, viewMode]);

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
    const startAnchor = getPayPeriodAnchorFromSelection({
      year: safeYear,
      month: safeMonth,
      payFrequency: normalizedPayFrequency,
    });
    const targets: Array<{ month: number; year: number }> = [];

    const pushSequence = (count: number) => {
      for (let index = 0; index < count; index += 1) {
        const absolute = (startAnchor.month - 1) + index;
        const nextYear = startAnchor.year + Math.floor(absolute / 12);
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
  }, [normalizedPayFrequency]);

  const applySacrificeAmount = useCallback(async (args: {
    targetType: "fixed" | "custom";
    fixedField?: FixedField;
    customAllocationId?: string;
    potId?: string;
    amount: number;
    startMonth: number;
    startYear: number;
    period: SacrificePeriod;
    skipSavingIndicator?: boolean;
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
    const showSavingIndicator = args.skipSavingIndicator !== true;
    const previousSacrifice = sacrifice;
    const linkedInvestmentPotById = args.targetType === "custom" && args.potId
      ? savingsPots.find((pot) => pot.field === "investment" && pot.id === args.potId)
      : undefined;
    const linkedInvestmentPot = linkedInvestmentPotById
      ?? (
        args.targetType === "custom" && args.customAllocationId
          ? savingsPots.find((pot) => pot.field === "investment" && pot.allocationId === args.customAllocationId)
          : undefined
      );

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
        let updatedExisting = false;
        nextCustomItems = nextCustomItems.map((item) => {
          if (item.id !== targetId) return item;
          updatedExisting = true;
          const oldAmount = Number(item.amount ?? 0);
          const newAmount = value;
          nextCustomTotal += newAmount - oldAmount;
          return { ...item, amount: newAmount };
        });

        if (!updatedExisting) {
          nextCustomItems = [
            ...nextCustomItems,
            {
              id: targetId,
              name: linkedInvestmentPot?.name?.trim() || "Investment",
              amount: value,
              isOverride: true,
            },
          ];
          nextCustomTotal += value;
        }
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
      if (showSavingIndicator) {
        setSacrificeSaving(true);
      }
      if (args.targetType === "fixed") {
        await withTimeout(
          updateIncomeSacrifice({
            budgetPlanId,
            month,
            year,
            targets,
            fixedFieldUpdate: {
              field: args.fixedField as FixedField,
              amount: value,
            },
          }).unwrap(),
          SACRIFICE_SAVE_TIMEOUT_MS,
          "Saving this period took too long."
        );
      } else {
        await withTimeout(
          updateIncomeSacrifice({
            budgetPlanId,
            month,
            year,
            targets,
            customAmountById: {
              [args.customAllocationId as string]: value,
            },
          }).unwrap(),
          SACRIFICE_SAVE_TIMEOUT_MS,
          "Saving this period took too long."
        );
      }

      if (linkedInvestmentPot) {
        try {
          const previousPotAmount = Math.max(0, Number(linkedInvestmentPot.amount) || 0);
          const nextPotAmount = Math.max(0, value);
          const nextPots = savingsPots.map((pot) => (
            pot.id === linkedInvestmentPot.id
              ? {
                ...pot,
                amount: nextPotAmount,
              }
              : pot
          ));

          await writeSavingsPotsForPlan(budgetPlanId, nextPots);
          setSavingsPots(nextPots);

          const delta = nextPotAmount - previousPotAmount;
          if (settings?.id && delta !== 0) {
            const updated = await updateSettingsMutation({
              budgetPlanId: settings.id,
              changes: {
                additionalInvestmentBalance: delta,
              },
            }).unwrap();
            settingsCacheRef.current[budgetPlanId] = updated;
            setSettings(updated);
          }
        } catch {
          // Keep the main sacrifice update successful even if linked pot/settings sync fails.
        }
      }

      invalidateMonthCaches(targets, { analysis: true, items: false, sacrifice: true });
      await Promise.all([loadSacrifice({ force: true }), load({ force: true }), refreshSavingsPots()]);
      seenMutationVersionRef.current = getApiMutationVersion();
    } catch (error) {
      if (affectsViewedMonth && previousSacrifice) {
        setSacrifice(previousSacrifice);
      }
      Alert.alert("Could not save sacrifice", getMobileApiErrorMessage(error, "Please try again."));
    } finally {
      if (showSavingIndicator) {
        setSacrificeSaving(false);
      }
    }
  }, [budgetPlanId, buildTargetMonths, canManageSacrifice, invalidateMonthCaches, load, loadSacrifice, month, refreshSavingsPots, sacrifice, savingsPots, settings?.id, updateIncomeSacrifice, updateSettingsMutation, writeSavingsPotsForPlan, year]);

  const createSacrificeItem = useCallback(async (args: {
    type: "allowance" | "savings" | "emergency" | "investment" | "custom";
    name: string;
    amount: number;
    broker?: string;
    goalTargetAmount?: number;
    goalTargetYear?: number;
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
    if (args.type === "investment" && !trimmedName) {
      Alert.alert("Bucket required", "Investment sacrifices need a bucket name. Choose a preset or type one like Broker.");
      return;
    }
    if (args.type === "custom" && (!Number.isFinite(args.amount) || args.amount <= 0)) {
      Alert.alert("Amount required", "Custom sacrifice requires a pay-period amount.");
      return;
    }
    if (args.type === "custom" && (!Number.isFinite(args.goalTargetAmount) || Number(args.goalTargetAmount) <= 0)) {
      Alert.alert("Target required", "Custom sacrifice requires a goal target amount.");
      return;
    }
    if (args.type === "custom" && (!Number.isFinite(args.goalTargetYear) || Number(args.goalTargetYear) < 1900)) {
      Alert.alert("Target year required", "Custom sacrifice requires a valid target year.");
      return;
    }
    let createdAllocationId: string | null = null;
    let createdPotId: string | null = null;
    const investmentAmount = Math.max(0, Number(args.amount) || 0);

    try {
      setSacrificeCreating(true);
      const created = await createIncomeSacrificeCustom({
        budgetPlanId,
        month,
        year,
        type: args.type,
        name: trimmedName,
        amount: args.amount,
        createGoal: args.type === "custom",
        goalTargetAmount: args.type === "custom" ? args.goalTargetAmount : undefined,
        goalTargetYear: args.type === "custom" ? args.goalTargetYear : undefined,
      }).unwrap();

      createdAllocationId = typeof created?.item?.id === "string" ? created.item.id.trim() : null;

      if (args.type === "investment" && createdAllocationId) {
        const nextPots = [
          ...savingsPots,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            field: "investment" as const,
            name: trimmedName,
            amount: investmentAmount,
            broker: normalizeSavingsPotBroker(args.broker),
            allocationId: createdAllocationId,
          },
        ];

        createdPotId = nextPots[nextPots.length - 1]?.id ?? null;
        await writeSavingsPotsForPlan(budgetPlanId, nextPots);
        setSavingsPots(nextPots);

        if (settings?.id && investmentAmount > 0) {
          const updated = await updateSettingsMutation({
            budgetPlanId: settings.id,
            changes: {
              additionalInvestmentBalance: investmentAmount,
            },
          }).unwrap();
          settingsCacheRef.current[budgetPlanId] = updated;
          setSettings(updated);
        }
      }

      invalidateMonthCaches([{ month, year }], { analysis: true, items: false, sacrifice: true });
      await Promise.all([loadSacrifice({ force: true }), load({ force: true })]);
      seenMutationVersionRef.current = getApiMutationVersion();
    } catch (error) {
      if (args.type === "investment") {
        if (createdAllocationId) {
          try {
            await deleteIncomeSacrificeCustom({ id: createdAllocationId }).unwrap();
          } catch {
            // Best-effort rollback only.
          }
        }

        if (createdPotId) {
          try {
            const rolledBackPots = savingsPots.filter((pot) => pot.id !== createdPotId && pot.allocationId !== createdAllocationId);
            await writeSavingsPotsForPlan(budgetPlanId, rolledBackPots);
            setSavingsPots(rolledBackPots);
          } catch {
            // Keep current local state if rollback fails.
          }
        }
      }
      Alert.alert("Could not create sacrifice", getMobileApiErrorMessage(error, "Please try again."));
      throw error;
    } finally {
      setSacrificeCreating(false);
    }
  }, [
    budgetPlanId,
    canManageSacrifice,
    createIncomeSacrificeCustom,
    deleteIncomeSacrificeCustom,
    invalidateMonthCaches,
    load,
    loadSacrifice,
    month,
    savingsPots,
    settings?.id,
    updateSettingsMutation,
    writeSavingsPotsForPlan,
    year,
  ]);

  const ensurePotAllocationRoute = useCallback(async (args: {
    field: SavingsField;
    potId: string;
    potName: string;
  }): Promise<string | null> => {
    try {
      const storedPots = await readSavingsPotsForPlan(budgetPlanId);
      const syncedPots = await ensureSavingsPotAllocationLinks(budgetPlanId, storedPots);
      setSavingsPots(syncedPots);

      const normalizedName = args.potName.trim().toLowerCase();
      const matchedPot = syncedPots.find((pot) => (
        pot.field === args.field
        && (pot.id === args.potId || pot.name.trim().toLowerCase() === normalizedName)
      ));

      if (matchedPot?.allocationId) {
        return matchedPot.allocationId;
      }

      if (args.field === "investment" && matchedPot) {
        const now = new Date();
        const created = await createIncomeSacrificeCustom({
          budgetPlanId,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          type: "investment",
          name: matchedPot.name,
          amount: Math.max(0, Number(matchedPot.amount) || 0),
        }).unwrap();

        const allocationId = typeof created?.item?.id === "string" ? created.item.id.trim() : "";
        if (!allocationId) return null;

        const nextPots = syncedPots.map((pot) => (
          pot.id === matchedPot.id
            ? {
              ...pot,
              allocationId,
            }
            : pot
        ));

        await writeSavingsPotsForPlan(budgetPlanId, nextPots);
        setSavingsPots(nextPots);
        return allocationId;
      }

      return null;
    } catch {
      return null;
    }
  }, [budgetPlanId, createIncomeSacrificeCustom, ensureSavingsPotAllocationLinks, readSavingsPotsForPlan, writeSavingsPotsForPlan]);

  const deleteSacrificeItem = async (id: string) => {
    if (!canManageSacrifice) {
      Alert.alert("Manage closed", "Income sacrifice can only be managed until 5 days after the period ends.");
      return;
    }

    const linkedInvestmentPots = savingsPots.filter((pot) => pot.field === "investment" && pot.allocationId === id);

    try {
      setSacrificeDeletingId(id);
      await deleteIncomeSacrificeCustom({ id }).unwrap();

      if (linkedInvestmentPots.length > 0) {
        try {
          const linkedPotIds = new Set(linkedInvestmentPots.map((pot) => pot.id));
          const nextPots = savingsPots.filter((pot) => !linkedPotIds.has(pot.id));
          await writeSavingsPotsForPlan(budgetPlanId, nextPots);
          setSavingsPots(nextPots);

          const linkedAmountTotal = linkedInvestmentPots.reduce(
            (sum, pot) => sum + Math.max(0, Number(pot.amount) || 0),
            0,
          );
          if (settings?.id && linkedAmountTotal > 0) {
            const updated = await updateSettingsMutation({
              budgetPlanId: settings.id,
              changes: {
                additionalInvestmentBalance: -linkedAmountTotal,
              },
            }).unwrap();
            settingsCacheRef.current[budgetPlanId] = updated;
            setSettings(updated);
          }
        } catch {
          // Keep the main sacrifice deletion successful even if linked settings sync fails.
        }
      }

      invalidateMonthCaches([{ month, year }], { analysis: true, items: false, sacrifice: true });
      await Promise.all([loadSacrifice({ force: true }), load({ force: true })]);
      seenMutationVersionRef.current = getApiMutationVersion();
    } catch (error) {
      Alert.alert("Could not delete sacrifice", getMobileApiErrorMessage(error, "Please try again."));
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
      await updateIncomeSacrificeGoalLink({
        budgetPlanId,
        targetKey: args.targetKey,
        goalId: args.goalId,
      }).unwrap();
      invalidateMonthCaches([{ month, year }], { analysis: false, items: false, sacrifice: true });
      await loadSacrifice({ force: true });
      seenMutationVersionRef.current = getApiMutationVersion();
    } catch (error) {
      Alert.alert("Could not save link", getMobileApiErrorMessage(error, "Please try again."));
    } finally {
      setLinkSaving(false);
    }
  }, [budgetPlanId, canManageSacrifice, invalidateMonthCaches, loadSacrifice, month, updateIncomeSacrificeGoalLink, year]);

  const confirmSacrificeTransfer = useCallback(async (targetKey: string) => {
    if (!canManageSacrifice) {
      Alert.alert("Manage closed", "Income sacrifice can only be managed until 5 days after the period ends.");
      return;
    }

    if (!targetKey.trim()) return;

    try {
      setConfirmingTargetKey(targetKey);
      await confirmIncomeSacrificeGoalTransfer({
        budgetPlanId,
        month,
        year,
        targetKey,
      }).unwrap();
      invalidateMonthCaches([{ month, year }], { analysis: true, items: false, sacrifice: true });
      await Promise.all([loadSacrifice({ force: true }), load({ force: true })]);
      seenMutationVersionRef.current = getApiMutationVersion();
      Alert.alert("Confirmed", "Transfer confirmed and goal progress updated.");
    } catch (error) {
      Alert.alert("Could not confirm", getMobileApiErrorMessage(error, "Please try again."));
    } finally {
      setConfirmingTargetKey(null);
    }
  }, [budgetPlanId, canManageSacrifice, confirmIncomeSacrificeGoalTransfer, invalidateMonthCaches, load, loadSacrifice, month, year]);

  const updateInvestmentPotBroker = useCallback(async (args: { potId: string; broker: string }) => {
    const normalizedBroker = normalizeSavingsPotBroker(args.broker);
    const matchedPot = savingsPots.find((pot) => pot.id === args.potId && pot.field === "investment");
    if (!matchedPot) return;
    if (normalizeSavingsPotBroker(matchedPot.broker) === normalizedBroker) return;

    const nextPots = savingsPots.map((pot) => (
      pot.id === matchedPot.id
        ? {
          ...pot,
          broker: normalizedBroker,
        }
        : pot
    ));

    await writeSavingsPotsForPlan(budgetPlanId, nextPots);
    setSavingsPots(nextPots);
  }, [budgetPlanId, savingsPots, writeSavingsPotsForPlan]);

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

  const safeAreaPaddingTop = isSacrificeManageActive
    ? 0
    : isStandaloneSacrifice
      ? 0
      : topHeaderOffset;

  return (
		<SafeAreaView style={[s.safe, { paddingTop: safeAreaPaddingTop }]} edges={["bottom"]}>
      {isStandaloneSacrifice && !isSacrificeManageActive ? <TabRouteHeader /> : null}
      <KeyboardAvoidingView style={s.body} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {!isSacrificeManageActive ? (
          <IncomeMonthHeader
            monthLabel={monthLabel}
            isLocked={isLocked}
            viewMode={viewMode}
            showAddForm={crud.showAddForm}
            hideNavTitleRow
            onHeightChange={setHeaderHeight}
            onBack={handleBackPress}
            onPrevPeriod={canGoToPreviousPeriod ? handleGoToPreviousPeriod : undefined}
            onNextPeriod={handleGoToNextPeriod}
            onToggleAdd={() => {
              if (isLocked) return;
              crud.setShowAddForm((v) => !v);
            }}
            onSetMode={handleSetViewMode}
          />
        ) : null}

        {viewMode === "sacrifice" ? (
          <IncomeMonthSacrificeList
            currency={currency}
            month={month}
            year={year}
            monthLabel={monthLabel}
            payDate={settings?.payDate ?? 27}
            payFrequency={normalizedPayFrequency}
            sacrifice={sacrifice}
            openAddSheetToken={sacrificeAddSheetToken}
            savingsPots={savingsPots}
            topInset={isSacrificeManageActive ? insets.top : headerHeight + 8}
            onManageFlowActiveChange={setIsSacrificeManageActive}
            canManage={canManageSacrifice}
            manageUnavailableReason={manageSacrificeNotice}
            sacrificeSaving={sacrificeSaving}
            sacrificeCreating={sacrificeCreating}
            sacrificeDeletingId={sacrificeDeletingId}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              Promise.all([load({ force: true }), loadSacrifice({ force: true }), refreshSavingsPots()]).finally(() => setRefreshing(false));
            }}
            onApplySacrificeAmount={applySacrificeAmount}
            onEnsurePotAllocationRoute={ensurePotAllocationRoute}
            onDeleteCustom={deleteSacrificeItem}
            onCreateItem={createSacrificeItem}
            onUpdateInvestmentPotBroker={updateInvestmentPotBroker}
            onSaveGoalLink={saveSacrificeGoalLink}
            onConfirmTransfer={confirmSacrificeTransfer}
            goalLinkSaving={linkSaving}
            confirmingTargetKey={confirmingTargetKey}
            onGoHome={returnToDashboard}
            onGoToCurrentPeriod={handleGoToCurrentPeriod}
            onGoToNextPeriod={handleGoToNextPeriod}
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
            analysis={optimisticAnalysis}
            currency={currency}
            isLocked={isLocked}
            topInset={headerHeight + 8}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load({ force: true });
            }}
            onPressIncomeSacrifice={openStandaloneSacrifice}
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

