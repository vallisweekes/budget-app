import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused, useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { useBootstrapData, isNoBudgetPlanError } from "@/context/BootstrapDataContext";
import type { DashboardData } from "@/lib/apiTypes";
import { currencySymbol, normalizeUpcomingName } from "@/lib/formatting";
import { usePayPeriodBoundaryRefresh, useSwipeDownToClose, useTopHeaderOffset } from "@/hooks";
import { normalizePayFrequency } from "@/lib/payPeriods";
import type { MainTabScreenProps } from "@/navigation/types";
import type { QuickPaymentActionItem } from "@/types";
import { buildDashboardDerived } from "@/components/DashboardScreen/derived";
import { GOAL_CARD, GOAL_GAP } from "@/components/DashboardScreen/style";

type DashboardScreenProps = MainTabScreenProps<"Dashboard">;
type CategorySheetState = { id: string; name: string } | null;

function normalizeQueryError(nextError: unknown, fallbackMessage: string): Error | null {
  if (!nextError) return null;
  if (nextError instanceof Error) return nextError;
  if (typeof nextError === "object" && nextError !== null && "message" in nextError) {
    const message = (nextError as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return new Error(message);
    }
  }
  return new Error(fallbackMessage);
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
  const payPeriodBoundaryVersion = usePayPeriodBoundaryRefresh({
    enabled: Boolean(isFocused && budgetPlanId),
    identityKey: [
      budgetPlanId,
      settings?.payDate ?? dashboard?.payDate ?? 27,
      payFrequency,
      payAnchorDate ?? "",
      settings?.setupCompletedAt ?? settings?.accountCreatedAt ?? "",
    ].join("|"),
    payDate: settings?.payDate ?? dashboard?.payDate ?? 27,
    payFrequency,
    payAnchorDate,
    planCreatedAt,
  });
  const resolvedDashboard = useMemo<DashboardData | null>(() => dashboard ?? null, [dashboard]);

  const hasBudgetHeroData = Boolean(resolvedDashboard);
  const hasRenderableHeroData = hasBudgetHeroData;
  const isWaitingForEnrichmentData = Boolean(!resolvedDashboard && bootstrapLoading);
  const loading = (
    !hasRenderableHeroData && (
      bootstrapLoading
      || !settings
    )
  );

  const { dragY: categorySheetDragY, panHandlers: categorySheetPanHandlers } = useSwipeDownToClose({
    onClose: () => setCategorySheet(null),
  });

  const effectiveError = useMemo<Error | null>(() => {
    if (error && isNoBudgetPlanError(error)) {
      return error;
    }

    if (hasRenderableHeroData) {
      return null;
    }

    return normalizeQueryError(error, "Failed to load dashboard");
  }, [error, hasRenderableHeroData]);

  useEffect(() => {
    if (isNoBudgetPlanError(effectiveError)) {
      router.push("/settings");
    }
  }, [effectiveError, router]);

  const load = useCallback(
    async (options?: { force?: boolean }) => {
      return await refresh({ force: options?.force === true });
    },
    [refresh]
  );

  useFocusEffect(
    useCallback(() => {
      void ensureLoaded();
    }, [ensureLoaded])
  );

  useEffect(() => {
    if (!isFocused) return;
    if (bootstrapLoading) return;
    if (!budgetPlanId) return;
    if (hasBootstrapDashboard) return;

    void ensureLoaded();
  }, [bootstrapLoading, budgetPlanId, ensureLoaded, hasBootstrapDashboard, isFocused]);

  const onRefresh = useCallback(() => {
    void load({ force: true });
  }, [load]);

  useEffect(() => {
    if (!payPeriodBoundaryVersion) return;

    void load({ force: true });
  }, [load, payPeriodBoundaryVersion]);

  const effectiveDisplayedAnchor = null;

  const derived = useMemo(
    () => buildDashboardDerived({ dashboard: resolvedDashboard, settings, categorySheet, displayedAnchor: effectiveDisplayedAnchor }),
    [categorySheet, effectiveDisplayedAnchor, resolvedDashboard, settings]
  );

  const currency = currencySymbol(settings?.currency);
  const displayTotalIncome = derived.totalIncome;
  const displayTotalExpenses = derived.totalExpenses;
  const displayPaidTotal = derived.paidTotal;
  const displayTotalBudget = derived.totalBudget;
  const displayAmountAfterExpenses = derived.amountAfterExpenses;
  const displayOverLimitDebtCount = derived.overLimitDebtCount;
  const displayHasOverLimitDebt = displayOverLimitDebtCount > 0;
  const displayIsOverBudgetBySpending = derived.isOverBudgetBySpending;
  const displayPayPeriodLabel = derived.payPeriodLabel;
  const displayCategories = derived.categories;
  const displayUpcoming = derived.upcoming;
  const needsSetup = hasBudgetHeroData ? (displayTotalIncome <= 0 || displayTotalExpenses <= 0) : false;
  const hasEnrichmentData = Boolean(resolvedDashboard);
  const summaryPreviewLabel = derived.payPeriodLabel;
  const summaryPreviewSpentTotal = 0;
  const summaryPreviewTotalCount = 0;
  const summaryPreviewUnpaidCount = 0;
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

  const closeCategorySheet = useCallback(() => setCategorySheet(null), []);
  const openCategorySheet = useCallback((category: { id: string; name: string }) => {
    if (!resolvedDashboard) {
      return;
    }
    setCategorySheet(category);
  }, [resolvedDashboard]);
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
    error: effectiveError,
    settings,
    currency,
    categorySheet,
    categorySheetDragY,
    categorySheetPanHandlers,
    quickPayItem,
    activeGoalCard,
    needsSetup,
    hasBudgetHeroData,
    hasEnrichmentData,
    isWaitingForEnrichmentData,
    hasSummaryPreview: false,
    summaryPreviewLabel,
    summaryPreviewSpentTotal,
    summaryPreviewTotalCount,
    summaryPreviewUnpaidCount,
    recap,
    dashboardTips,
    hasRecapData,
    recapTitle,
    isRedirectingForSetup: Boolean(effectiveError && isNoBudgetPlanError(effectiveError)),
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
    totalBudget: displayTotalBudget,
    totalExpenses: displayTotalExpenses,
    paidTotal: displayPaidTotal,
    totalIncome: displayTotalIncome,
    categories: displayCategories,
    upcoming: displayUpcoming,
    payPeriodLabel: displayPayPeriodLabel,
    amountAfterExpenses: displayAmountAfterExpenses,
    isOverBudgetBySpending: displayIsOverBudgetBySpending,
    hasOverLimitDebt: displayHasOverLimitDebt,
    overLimitDebtCount: displayOverLimitDebtCount,
  };
}