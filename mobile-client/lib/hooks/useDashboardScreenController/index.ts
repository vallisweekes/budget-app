import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused, useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { useBootstrapData, isNoBudgetPlanError } from "@/context/BootstrapDataContext";
import { getApiMutationVersion } from "@/lib/api";
import type { DashboardData } from "@/lib/apiTypes";
import { SCREEN_FOCUS_REVALIDATE_TTL_MS } from "@/lib/constants";
import { resolveDisplayedPayPeriodAnchor } from "@/lib/helpers/resolveDisplayedPayPeriodAnchor";
import { currencySymbol, normalizeUpcomingName } from "@/lib/formatting";
import { usePostDashboardWarmup, useSwipeDownToClose, useTopHeaderOffset } from "@/hooks";
import { normalizePayFrequency } from "@/lib/payPeriods";
import type { MainTabScreenProps } from "@/navigation/types";
import { useGetDashboardByPeriodQuery } from "@/store/api";
import type { QuickPaymentActionItem } from "@/types";
import { buildDashboardDerived } from "@/components/DashboardScreen/derived";
import { GOAL_CARD, GOAL_GAP } from "@/components/DashboardScreen/style";

type DashboardScreenProps = MainTabScreenProps<"Dashboard">;
type CategorySheetState = { id: string; name: string } | null;

function dashboardMatchesAnchor(
  dashboard: DashboardData | null | undefined,
  anchor: { month: number; year: number } | null | undefined,
): boolean {
  if (!dashboard || !anchor) return false;
  return Number(dashboard.monthNum) === anchor.month && Number(dashboard.year) === anchor.year;
}

export function useDashboardScreenController({ navigation: _navigation }: DashboardScreenProps) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const isFocused = useIsFocused();

  const topHeaderOffset = useTopHeaderOffset(-24);
  const insets = useSafeAreaInsets();
  const {
    dashboard,
    settings,
    isLoading: bootstrapLoading,
    isRefreshing: refreshing,
    error,
    refresh,
    ensureLoaded,
  } = useBootstrapData();

  const [categorySheet, setCategorySheet] = useState<CategorySheetState>(null);
  const [quickPayItem, setQuickPayItem] = useState<QuickPaymentActionItem | null>(null);
  const [activeGoalCard, setActiveGoalCard] = useState(0);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});
  const [displayedPeriodAnchor, setDisplayedPeriodAnchor] = useState<{ month: number; year: number } | null>(null);
  const [displayedPeriodResolved, setDisplayedPeriodResolved] = useState(false);
  const lastDisplayedPeriodResolvedAtRef = useRef<number | null>(null);
  const displayedPeriodContextRef = useRef("");
  const seenMutationVersionRef = useRef<number>(getApiMutationVersion());

  const budgetPlanId = useMemo(() => {
    if (typeof settings?.id === "string" && settings.id.trim()) {
      return settings.id;
    }
    if (typeof dashboard?.budgetPlanId === "string" && dashboard.budgetPlanId.trim()) {
      return dashboard.budgetPlanId;
    }
    return "";
  }, [dashboard?.budgetPlanId, settings?.id]);

  const hasBootstrapDashboard = Boolean(dashboard);
  const payFrequency = useMemo(
    () => normalizePayFrequency(dashboard?.payFrequency ?? settings?.payFrequency),
    [dashboard?.payFrequency, settings?.payFrequency],
  );
  const payAnchorDate = useMemo(
    () => (payFrequency === "monthly" ? null : (settings?.payAnchorDate ?? null)),
    [payFrequency, settings?.payAnchorDate],
  );
  const planCreatedAt = useMemo(
    () => (settings?.setupCompletedAt
      ? new Date(settings.setupCompletedAt)
      : settings?.accountCreatedAt
        ? new Date(settings.accountCreatedAt)
        : null),
    [settings?.accountCreatedAt, settings?.setupCompletedAt],
  );
  const displayedPeriodContextKey = useMemo(() => {
    if (!budgetPlanId) return "";

    return [
      budgetPlanId,
      settings?.payDate ?? dashboard?.payDate ?? 27,
      payFrequency,
      payAnchorDate ?? "",
      settings?.setupCompletedAt ?? settings?.accountCreatedAt ?? "",
    ].join("|");
  }, [budgetPlanId, dashboard?.payDate, payAnchorDate, payFrequency, settings?.accountCreatedAt, settings?.payDate, settings?.setupCompletedAt]);

  const shouldLoadPeriodDashboard = useMemo(
    () => Boolean(isFocused && hasBootstrapDashboard && displayedPeriodAnchor && budgetPlanId && !dashboardMatchesAnchor(dashboard, displayedPeriodAnchor)),
    [budgetPlanId, dashboard, displayedPeriodAnchor, hasBootstrapDashboard, isFocused],
  );

  const periodDashboardArgs = useMemo(
    () => (displayedPeriodAnchor && budgetPlanId
      ? { budgetPlanId, month: displayedPeriodAnchor.month, year: displayedPeriodAnchor.year }
      : undefined),
    [budgetPlanId, displayedPeriodAnchor],
  );

  const periodDashboardQuery = useGetDashboardByPeriodQuery(periodDashboardArgs as {
    budgetPlanId: string;
    month: number;
    year: number;
  }, {
    skip: !shouldLoadPeriodDashboard,
  });

  const resolvedDashboard = useMemo<DashboardData | null>(() => {
    if (!shouldLoadPeriodDashboard) {
      return dashboard ?? null;
    }

    return periodDashboardQuery.data ?? dashboard ?? null;
  }, [dashboard, periodDashboardQuery.data, shouldLoadPeriodDashboard]);

  const loading = !displayedPeriodResolved
    || (bootstrapLoading && !resolvedDashboard)
    || (shouldLoadPeriodDashboard && !periodDashboardQuery.data && (periodDashboardQuery.isLoading || periodDashboardQuery.isFetching));

  const { dragY: categorySheetDragY, panHandlers: categorySheetPanHandlers } = useSwipeDownToClose({
    onClose: () => setCategorySheet(null),
  });

  useEffect(() => {
    if (isNoBudgetPlanError(error)) {
      router.push("/settings");
    }
  }, [error, router]);

  const load = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force === true;
      const result = await refresh({ force });

      if (force && shouldLoadPeriodDashboard) {
        await periodDashboardQuery.refetch();
      }

      return result;
    },
    [periodDashboardQuery, refresh, shouldLoadPeriodDashboard]
  );

  useFocusEffect(
    useCallback(() => {
      void ensureLoaded();
    }, [ensureLoaded])
  );

  const onRefresh = useCallback(() => {
    void load({ force: true });
  }, [load]);

  const effectiveDisplayedAnchor = useMemo(
    () => (dashboardMatchesAnchor(resolvedDashboard, displayedPeriodAnchor) ? displayedPeriodAnchor : null),
    [displayedPeriodAnchor, resolvedDashboard],
  );

  const derived = useMemo(
    () => buildDashboardDerived({ dashboard: resolvedDashboard, settings, categorySheet, displayedAnchor: effectiveDisplayedAnchor }),
    [categorySheet, effectiveDisplayedAnchor, resolvedDashboard, settings]
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isFocused) {
        return;
      }

      if (!budgetPlanId) {
        if (!cancelled) {
          setDisplayedPeriodAnchor(null);
          setDisplayedPeriodResolved(true);
        }
        displayedPeriodContextRef.current = "";
        lastDisplayedPeriodResolvedAtRef.current = null;
        return;
      }

      const latestMutationVersion = getApiMutationVersion();
      const hasMutationChanges = latestMutationVersion !== seenMutationVersionRef.current;
      const hasFreshDisplayedPeriod = displayedPeriodResolved
        && displayedPeriodAnchor !== null
        && displayedPeriodContextRef.current === displayedPeriodContextKey
        && lastDisplayedPeriodResolvedAtRef.current !== null
        && (Date.now() - lastDisplayedPeriodResolvedAtRef.current) < SCREEN_FOCUS_REVALIDATE_TTL_MS;

      if (!hasMutationChanges && hasFreshDisplayedPeriod) {
        return;
      }

      if (!cancelled) {
        setDisplayedPeriodResolved(false);
      }

      const next = await resolveDisplayedPayPeriodAnchor({
        budgetPlanId,
        payDate: settings?.payDate ?? dashboard?.payDate ?? 27,
        payAnchorDate,
        payFrequency,
        planCreatedAt,
      });

      if (!cancelled) {
        setDisplayedPeriodAnchor(next);
        setDisplayedPeriodResolved(true);
        seenMutationVersionRef.current = latestMutationVersion;
        displayedPeriodContextRef.current = displayedPeriodContextKey;
        lastDisplayedPeriodResolvedAtRef.current = Date.now();
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [budgetPlanId, dashboard, displayedPeriodAnchor, displayedPeriodContextKey, displayedPeriodResolved, isFocused, payAnchorDate, payFrequency, settings?.payDate, planCreatedAt]);

  const currency = currencySymbol(settings?.currency);
  const needsSetup = derived.totalIncome <= 0 || derived.totalExpenses <= 0;
  const recap = resolvedDashboard?.expenseInsights?.recap ?? null;
  const dashboardTips = resolvedDashboard?.expenseInsights?.recapTips ?? [];
  const hasRecapData = Boolean(
    recap && (
      (recap.paidCount ?? 0) > 0
      || (recap.paidAmount ?? 0) > 0
      || (recap.missedDueCount ?? 0) > 0
      || (recap.missedDueAmount ?? 0) > 0
    )
  );
  const recapTitle = recap
    ? (derived.hasPayDateConfigured ? `${derived.previousPayPeriodLabel} Recap` : `${recap.label} Recap`)
    : "";

  usePostDashboardWarmup({
    dashboard: resolvedDashboard,
    settings,
    isFocused,
  });

  const closeCategorySheet = useCallback(() => setCategorySheet(null), []);
  const openCategorySheet = useCallback((category: { id: string; name: string }) => setCategorySheet(category), []);
  const closeQuickPay = useCallback(() => setQuickPayItem(null), []);

  const handleQuickPayUpdated = useCallback(() => {
    void load({ force: true });
  }, [load]);

  const openExpenseQuickPay = useCallback((expense: {
    id: string;
    name: string;
    amount: number;
    paidAmount?: number | null;
    dueDate?: string | null;
    logoUrl?: string | null;
  }) => {
    setQuickPayItem({
      kind: "expense",
      id: expense.id,
      name: expense.name,
      amount: expense.amount,
      paidAmount: expense.paidAmount ?? undefined,
      dueDate: expense.dueDate,
      logoUrl: expense.logoUrl ?? null,
    });
  }, []);

  const openDebtQuickPay = useCallback((debt: {
    id: string;
    name: string;
    dueAmount?: number | null;
    logoUrl?: string | null;
  }) => {
    setQuickPayItem({
      kind: "debt",
      id: debt.id,
      name: normalizeUpcomingName(debt.name),
      amount: debt.dueAmount ?? 0,
      logoUrl: debt.logoUrl ?? null,
      subtitle: "Monthly payment",
    });
  }, []);

  const markLogoFailed = useCallback((key: string) => {
    setFailedLogos((current) => (current[key] ? current : { ...current, [key]: true }));
  }, []);

  const isLogoFailed = useCallback((key: string) => Boolean(failedLogos[key]), [failedLogos]);

  const handleGoalMomentumEnd = useCallback((offsetX: number) => {
    const maxIndex = Math.max(0, derived.goalCardsData.length - 1);
    const nextIndex = Math.round(offsetX / (GOAL_CARD + GOAL_GAP));
    setActiveGoalCard(Math.max(0, Math.min(maxIndex, nextIndex)));
  }, [derived.goalCardsData.length]);

  return {
    scrollRef,
    topHeaderOffset,
    insetsBottom: insets.bottom,
    loading,
    refreshing,
    error,
    settings,
    currency,
    categorySheet,
    categorySheetDragY,
    categorySheetPanHandlers,
    quickPayItem,
    activeGoalCard,
    needsSetup,
    recap,
    dashboardTips,
    hasRecapData,
    recapTitle,
    isRedirectingForSetup: Boolean(error && isNoBudgetPlanError(error)),
    load,
    onRefresh,
    openCategorySheet,
    closeCategorySheet,
    closeQuickPay,
    handleQuickPayUpdated,
    openExpenseQuickPay,
    openDebtQuickPay,
    markLogoFailed,
    isLogoFailed,
    handleGoalMomentumEnd,
    goToPayments: () => router.push("/(payments-tabs)/search"),
    goToIncome: () => router.push("/(tabs)/income"),
    goToExpenses: () => router.push("/(tabs)/expenses"),
    goToDebts: () => router.push("/(tabs)/debts"),
    goToGoals: () => router.push("/(tabs)/goals"),
    goToGoalsAdd: () => router.push({
      pathname: "/(tabs)/goals",
      params: { openAddToken: String(Date.now()) },
    }),
    goToGoalsProjection: () => router.push("/GoalsProjection"),
    goToSettings: () => router.push("/settings"),
    ...derived,
  };
}