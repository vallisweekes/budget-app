import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { useBootstrapData, isNoBudgetPlanError } from "@/context/BootstrapDataContext";
import { currencySymbol, normalizeUpcomingName } from "@/lib/formatting";
import { useSwipeDownToClose, useTopHeaderOffset } from "@/hooks";
import type { MainTabScreenProps } from "@/navigation/types";
import type { QuickPaymentActionItem } from "@/types";
import { buildDashboardDerived } from "@/components/DashboardScreen/derived";
import { GOAL_CARD, GOAL_GAP } from "@/components/DashboardScreen/style";

type DashboardScreenProps = MainTabScreenProps<"Dashboard">;
type CategorySheetState = { id: string; name: string } | null;

export function useDashboardScreenController({ navigation }: DashboardScreenProps) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const topHeaderOffset = useTopHeaderOffset(-24);
  const insets = useSafeAreaInsets();
  const {
    dashboard,
    settings,
    isLoading: loading,
    isRefreshing: refreshing,
    error,
    refresh,
    ensureLoaded,
  } = useBootstrapData();

  const [categorySheet, setCategorySheet] = useState<CategorySheetState>(null);
  const [quickPayItem, setQuickPayItem] = useState<QuickPaymentActionItem | null>(null);
  const [activeGoalCard, setActiveGoalCard] = useState(0);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});

  const { dragY: categorySheetDragY, panHandlers: categorySheetPanHandlers } = useSwipeDownToClose({
    onClose: () => setCategorySheet(null),
  });

  useEffect(() => {
    if (isNoBudgetPlanError(error)) {
      navigation.navigate("Settings");
    }
  }, [error, navigation]);

  const load = useCallback(
    (options?: { force?: boolean }) => refresh({ force: options?.force === true }),
    [refresh]
  );

  useFocusEffect(
    useCallback(() => {
      void ensureLoaded();
    }, [ensureLoaded])
  );

  const onRefresh = useCallback(() => {
    void load({ force: true });
  }, [load]);

  const derived = useMemo(
    () => buildDashboardDerived({ dashboard, settings, categorySheet }),
    [categorySheet, dashboard, settings]
  );

  const currency = currencySymbol(settings?.currency);
  const needsSetup = derived.totalIncome <= 0 || derived.totalExpenses <= 0;
  const recap = dashboard?.expenseInsights?.recap ?? null;
  const dashboardTips = dashboard?.expenseInsights?.recapTips ?? [];
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
    goToPayments: () => router.push("/(modals)/payments"),
    goToIncome: () => router.push("/(tabs)/income"),
    goToExpenses: () => router.push("/(tabs)/expenses"),
    goToDebts: () => router.push("/(tabs)/debts"),
    goToGoals: () => router.push("/(tabs)/goals"),
    goToGoalsAdd: () => router.push({
      pathname: "/(tabs)/goals",
      params: { openAddToken: String(Date.now()) },
    }),
    goToGoalsProjection: () => router.push("/goals-projection"),
    goToSettings: () => router.push("/(tabs)/settings"),
    ...derived,
  };
}