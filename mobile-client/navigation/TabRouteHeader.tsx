import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, usePathname, useRouter, useSegments } from "expo-router";

import TopHeader from "@/components/Shared/TopHeader";
import { useActiveBudgetPlan } from "@/context/ActiveBudgetPlanContext";
import { useAuth } from "@/context/AuthContext";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { useAppTranslation } from "@/hooks";
import { getSharedExpensePeriodRouteState } from "@/lib/helpers/expensePeriodRouteState";
import { markSkipExpensesFocusReload } from "@/lib/helpers/expensesFocusReload";
import { translateGoalTitle } from "@/lib/i18n";
import { subscribeNotificationInbox } from "@/lib/notificationInbox";
import { T } from "@/lib/theme";
import { getAnalyticsReturnHref, isAnalyticsNavigationHref, rememberAnalyticsReturnHref } from "@/navigation/analyticsReturnRoute";
import { buildPersistedHref } from "@/navigation/routePersistence";
import { IncomeMonthSwitcher } from "@/navigation/routerHeaders";

type LocalParam = string | string[] | undefined;

function getStringParam(value: LocalParam): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function getNumberParam(value: LocalParam): number {
  const raw = getStringParam(value);
  if (raw === undefined) return Number.NaN;
  return Number(raw);
}

function getRouteParamString(routeParams: Record<string, unknown>, key: string): string | undefined {
  return typeof routeParams?.[key] === "string" ? String(routeParams[key]) : undefined;
}

function getRouteParamNumber(routeParams: Record<string, unknown>, key: string): number {
  const value = routeParams?.[key];
  return typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
}

export default function TabRouteHeader() {
  const { t } = useAppTranslation();
  const { settings } = useBootstrapData();
  const pathname = usePathname();
  const router = useRouter();
  const navigation = useNavigation<any>();
  const segments = useSegments() as string[];
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const { profile } = useAuth();
  const { activeBudgetPlanId, bootstrapBudgetPlanId } = useActiveBudgetPlan();
  const [notificationUnreadCount, setNotificationUnreadCount] = React.useState(0);
  const availablePlanIds = React.useMemo(
    () => new Set((profile?.plans ?? []).map((plan) => plan.id)),
    [profile?.plans],
  );

  React.useEffect(() => {
    const unsubscribe = subscribeNotificationInbox((snapshot) => {
      setNotificationUnreadCount(snapshot.unreadCount);
    });
    return unsubscribe;
  }, []);

  const rootSegment = typeof segments[0] === "string" ? segments[0] : "";
  const tabSegment = rootSegment === "(tabs)" && typeof segments[1] === "string" ? segments[1] : "";
  const leafSegment = rootSegment === "(tabs)" && typeof segments[2] === "string" ? segments[2] : "";
  const isAnalytics = rootSegment === "analytics";
  const isAnalyticsDebtDistribution = rootSegment === "analytics-debt-distribution";
  const isAnalyticsRoute = isAnalytics || isAnalyticsDebtDistribution;
  const isSettings = rootSegment === "settings";
  const isSettingsProfileDetails = rootSegment === "settings-profile-details";
  const isSettingsIncomeSettings = rootSegment === "settings-income-settings";
  const isSettingsStrategy = rootSegment === "settings-strategy";
  const isSettingsDebtManagement = rootSegment === "settings-debt-management";
  const isGoals = tabSegment === "goals";
  const isGoalsProjection = tabSegment === "goals-projection";
  const isGoalsSection = isGoals || isGoalsProjection;
  const isLoggedSearch = tabSegment === "search";
  const isLoggedExpensesTabRoot = tabSegment === "logged-expenses";
  const isIncomeTab = tabSegment === "income";
  const isDebtAnalyticsTab = tabSegment === "debt-analytics";
  const isDebtSplitSection = tabSegment === "debts" || isDebtAnalyticsTab;
  const isDashboardHome = tabSegment === "dashboard" && !leafSegment;
  const isGoalDetail = leafSegment === "GoalDetail";
  const isCategoryExpenses = leafSegment === "CategoryExpenses";
  const isDebtDetail = leafSegment === "DebtDetail";
  const isExpenseDetail = leafSegment === "ExpenseDetail";
  const isLoggedExpenses = leafSegment === "LoggedExpenses" || tabSegment === "logged-expenses";
  const isExpensesList = leafSegment === "ExpensesList";
  const isUnplannedExpense = leafSegment === "UnplannedExpense";
  const isScanReceipt = leafSegment === "ScanReceipt";
  const isDebtAnalytics = leafSegment === "DebtAnalytics";
  const isAnyDebtAnalytics = isDebtAnalytics || isDebtAnalyticsTab;
  const getDeepestRoute = (state: any): any => {
    if (!state?.routes?.length) return null;
    const route = state.routes[state.index ?? state.routes.length - 1];
    if (route?.state) return getDeepestRoute(route.state);
    return route;
  };
  const deepestRoute = getDeepestRoute(navigation.getState?.());
  const deepestRouteName = typeof deepestRoute?.name === "string" ? deepestRoute.name : "";
  const routeParams = (deepestRoute?.params ?? {}) as Record<string, unknown>;
  const isIncomeMonth = leafSegment === "IncomeMonth" || deepestRouteName === "IncomeMonth";

  const routeMonthNum = getRouteParamNumber(routeParams, "month");
  const routeYearNum = getRouteParamNumber(routeParams, "year");
  const localMonthNum = getNumberParam(params.month);
  const localYearNum = getNumberParam(params.year);
  const monthNum = (() => {
    if (isIncomeMonth && Number.isFinite(routeMonthNum)) return routeMonthNum;
    if (Number.isFinite(localMonthNum)) return localMonthNum;
    return routeMonthNum;
  })();
  const yearNum = (() => {
    if (isIncomeMonth && Number.isFinite(routeYearNum)) return routeYearNum;
    if (Number.isFinite(localYearNum)) return localYearNum;
    return routeYearNum;
  })();
  const routeIncomeMonthBudgetPlanId = getRouteParamString(routeParams, "budgetPlanId") ?? "";
  const localIncomeMonthBudgetPlanId = getStringParam(params.budgetPlanId) ?? "";
  const rawIncomeMonthBudgetPlanId = isIncomeMonth
    ? (routeIncomeMonthBudgetPlanId || localIncomeMonthBudgetPlanId)
    : (localIncomeMonthBudgetPlanId || routeIncomeMonthBudgetPlanId);
  const incomeMonthBudgetPlanId = availablePlanIds.has(rawIncomeMonthBudgetPlanId)
    ? rawIncomeMonthBudgetPlanId
    : (activeBudgetPlanId || bootstrapBudgetPlanId || "");
  const localIncomeMonthInitialMode = getStringParam(params.initialMode) === "sacrifice"
    ? "sacrifice"
    : null;
  const routeIncomeMonthInitialMode = routeParams?.initialMode === "sacrifice"
    ? "sacrifice"
    : null;
  const incomeMonthInitialMode = (isIncomeMonth
    ? (routeIncomeMonthInitialMode ?? localIncomeMonthInitialMode)
    : (localIncomeMonthInitialMode ?? routeIncomeMonthInitialMode)) ?? "income";
  const isStandaloneSacrificeIncomeMonth = (getStringParam(params.standaloneSacrifice) === "true"
    || routeParams?.standaloneSacrifice === true)
    && isIncomeMonth;
  const incomeMonthManageActive = getStringParam(params.sacrificeManageActive) === "true"
    || routeParams?.sacrificeManageActive === true;
  const canUseIncomeMonthSwitcher = isIncomeMonth
    && Number.isFinite(monthNum)
    && monthNum >= 1
    && monthNum <= 12
    && Number.isFinite(yearNum)
    && Boolean(incomeMonthBudgetPlanId);

  const categoryExpensesName = getStringParam(params.categoryName);
  const resolvedCategoryExpensesName = categoryExpensesName ?? getRouteParamString(routeParams, "categoryName");
  const categoryExpensesMonth = (() => {
    const fromLocal = getNumberParam(params.month);
    if (Number.isFinite(fromLocal)) return fromLocal;
    return getRouteParamNumber(routeParams, "month");
  })();
  const categoryExpensesYear = (() => {
    const fromLocal = getNumberParam(params.year);
    if (Number.isFinite(fromLocal)) return fromLocal;
    return getRouteParamNumber(routeParams, "year");
  })();
  const settingsSubTab = getStringParam(params.subTab)
    ?? getRouteParamString(routeParams, "subTab")
    ?? "details";
  const isSettingsNotifications = isSettings && settingsSubTab === "notifications";
  const hasCategoryMonthYear = Number.isFinite(categoryExpensesMonth)
    && categoryExpensesMonth >= 1
    && categoryExpensesMonth <= 12
    && Number.isFinite(categoryExpensesYear);

  const centerLabel = isCategoryExpenses
    ? resolvedCategoryExpensesName ?? "Category"
    : isLoggedSearch
      ? "Search"
    : isLoggedExpenses
      ? "Logged"
      : isUnplannedExpense
        ? "Log Expense"
        : isScanReceipt
          ? "Upload Receipt"
          : isAnyDebtAnalytics
          ? t("tabs.debts") + " " + t("tabs.projection")
            : isSettingsProfileDetails
              ? t("settings.profileDetailsTitle")
            : isSettingsIncomeSettings
              ? t("settings.incomeSettingsTitle")
            : isSettingsStrategy
              ? t("settings.strategyTitle")
            : isSettingsDebtManagement
              ? t("settings.debtManagementTitle")
            : isAnalyticsDebtDistribution
              ? t("analytics.debt.distributionTitle")
            : isAnalytics
              ? t("analytics.title")
              : isSettings && settingsSubTab === "savings"
                ? t("settings.moneyTitle")
              : isSettings && settingsSubTab === "plans"
                ? t("settings.plansTitle")
              : isSettings && settingsSubTab === "locale"
                ? t("settings.localeCurrencyTitle")
              : isSettings && settingsSubTab === "notifications"
                ? t("settings.notificationsTitle")
              : isSettings && settingsSubTab === "budget"
                ? t("settings.budgetTitle")
              : isSettings && settingsSubTab === "subscription"
                ? t("settings.subscriptionTitle")
              : isGoalDetail
                ? translateGoalTitle(
                  getStringParam(params.goalTitle) ?? (typeof routeParams?.goalTitle === "string" ? routeParams.goalTitle : t("tabs.goals")),
                  settings?.language,
                )
              : isGoalsProjection
                ? t("tabs.projection")
              : isGoals
                ? t("tabs.goals")
                : undefined;

  const pushRoute = (pathname: string, nextParams?: Record<string, string | number | undefined>) => {
    router.push({ pathname, params: nextParams });
  };

  const replaceRoute = (pathname: string, nextParams?: Record<string, string | number | undefined>) => {
    router.replace({ pathname, params: nextParams });
  };

  const incomeMonthSwitcher = canUseIncomeMonthSwitcher ? (
    <IncomeMonthSwitcher
      month={Math.floor(monthNum)}
      year={Math.floor(yearNum)}
      budgetPlanId={incomeMonthBudgetPlanId}
      onNavigate={(nextMonth, nextYear) => {
        replaceRoute("/(tabs)/income/IncomeMonth", {
          month: nextMonth,
          year: nextYear,
          budgetPlanId: incomeMonthBudgetPlanId,
          initialMode: incomeMonthInitialMode,
        });
      }}
    />
  ) : undefined;

  const currentHref = React.useMemo(
    () => buildPersistedHref(pathname, params as Record<string, unknown>),
    [params, pathname],
  );

  const openAnalytics = () => {
    rememberAnalyticsReturnHref(currentHref);
    pushRoute("/analytics");
  };

  const handleAnalyticsBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    const returnHref = getAnalyticsReturnHref();

    if (!returnHref || isAnalyticsNavigationHref(returnHref) || returnHref === pathname || returnHref === currentHref) {
      router.replace("/(tabs)/dashboard");
      return;
    }

    router.replace(returnHref);
  };

  const handleBack = () => {
    if (isGoalsProjection) {
      pushRoute("/(tabs)/goals");
      return;
    }

    if (isStandaloneSacrificeIncomeMonth && Number.isFinite(monthNum) && Number.isFinite(yearNum) && incomeMonthBudgetPlanId) {
      replaceRoute("/(tabs)/income/IncomeMonth", {
        month: Math.floor(monthNum),
        year: Math.floor(yearNum),
        budgetPlanId: incomeMonthBudgetPlanId,
        initialMode: "income",
      });
      return;
    }

    if (isLoggedSearch) {
      const sharedExpenseRouteState = getSharedExpensePeriodRouteState();
      const displayedAnchor = sharedExpenseRouteState.displayedAnchor;
      const currentAnchor = sharedExpenseRouteState.currentAnchor;
      const categoryId = getStringParam(params.categoryId) ?? getRouteParamString(routeParams, "categoryId");
      const commonExpenseParams = {
        month: Number.isFinite(monthNum) ? Math.floor(monthNum) : displayedAnchor?.month,
        year: Number.isFinite(yearNum) ? Math.floor(yearNum) : displayedAnchor?.year,
        currentPeriodMonth: currentAnchor?.month,
        currentPeriodYear: currentAnchor?.year,
        budgetPlanId: getStringParam(params.budgetPlanId)
          ?? getRouteParamString(routeParams, "budgetPlanId")
          ?? sharedExpenseRouteState.budgetPlanId
          ?? undefined,
        currency: getStringParam(params.currency)
          ?? getRouteParamString(routeParams, "currency")
          ?? sharedExpenseRouteState.currency
          ?? "£",
        skipFocusReloadAt: Date.now(),
      };

      if (categoryId) {
        replaceRoute("/(tabs)/expenses/CategoryExpenses", {
          ...commonExpenseParams,
          categoryId,
          categoryName: getStringParam(params.categoryName) ?? getRouteParamString(routeParams, "categoryName"),
          color: getStringParam(params.color) ?? getRouteParamString(routeParams, "color"),
          icon: getStringParam(params.icon) ?? getRouteParamString(routeParams, "icon"),
        });
        return;
      }

      replaceRoute("/(tabs)/expenses/ExpensesList", commonExpenseParams);
      return;
    }

    if (isLoggedExpenses) {
      const categoryId = getStringParam(params.categoryId) ?? getRouteParamString(routeParams, "categoryId");

      if (categoryId) {
        replaceRoute("/(tabs)/expenses/CategoryExpenses", {
          categoryId,
          categoryName: getStringParam(params.categoryName) ?? getRouteParamString(routeParams, "categoryName"),
          color: getStringParam(params.color) ?? getRouteParamString(routeParams, "color"),
          icon: getStringParam(params.icon) ?? getRouteParamString(routeParams, "icon"),
          month: Number.isFinite(monthNum) ? Math.floor(monthNum) : undefined,
          year: Number.isFinite(yearNum) ? Math.floor(yearNum) : undefined,
          budgetPlanId: getStringParam(params.budgetPlanId) ?? getRouteParamString(routeParams, "budgetPlanId"),
          currency: getStringParam(params.currency) ?? getRouteParamString(routeParams, "currency") ?? "£",
          skipFocusReloadAt: Date.now(),
        });
        return;
      }

      replaceRoute("/(tabs)/expenses/ExpensesList", {
        month: Number.isFinite(monthNum) ? Math.floor(monthNum) : undefined,
        year: Number.isFinite(yearNum) ? Math.floor(yearNum) : undefined,
        budgetPlanId: getStringParam(params.budgetPlanId) ?? getRouteParamString(routeParams, "budgetPlanId"),
        currency: getStringParam(params.currency) ?? getRouteParamString(routeParams, "currency") ?? "£",
        skipFocusReloadAt: Date.now(),
      });
      return;
    }

    if (isCategoryExpenses) {
      markSkipExpensesFocusReload();
      replaceRoute("/(tabs)/expenses/ExpensesList", hasCategoryMonthYear
        ? {
            month: Math.floor(categoryExpensesMonth),
            year: Math.floor(categoryExpensesYear),
            skipFocusReloadAt: Date.now(),
          }
        : {
            skipFocusReloadAt: Date.now(),
          });
      return;
    }

    if (isUnplannedExpense || isScanReceipt) {
      replaceRoute("/(tabs)/expenses/ExpensesList", {
        month: Number.isFinite(monthNum) ? Math.floor(monthNum) : undefined,
        year: Number.isFinite(yearNum) ? Math.floor(yearNum) : undefined,
        skipFocusReloadAt: Date.now(),
      });
      return;
    }

    if (isDebtAnalyticsTab) {
      pushRoute("/(tabs)/debts");
      return;
    }

    if (isDebtAnalytics) {
      if (navigation.canGoBack?.()) {
        navigation.goBack();
        return;
      }

      replaceRoute("/(tabs)/debts");
      return;
    }

    if (isAnalytics) {
      handleAnalyticsBack();
      return;
    }

    if (isAnalyticsDebtDistribution) {
      replaceRoute("/analytics");
      return;
    }

    if (isSettings) {
      if (settingsSubTab !== "details") {
        replaceRoute("/settings", { subTab: "details" });
        return;
      }
      if (navigation.canGoBack?.()) {
        navigation.goBack();
        return;
      }
      replaceRoute("/(tabs)/dashboard");
      return;
    }

    if (isSettingsProfileDetails) {
      replaceRoute("/settings", { subTab: "details" });
      return;
    }

    if (isSettingsIncomeSettings) {
      if (navigation.canGoBack?.()) {
        navigation.goBack();
        return;
      }
      replaceRoute("/settings", { subTab: "budget" });
      return;
    }

    if (isSettingsStrategy) {
      if (navigation.canGoBack?.()) {
        navigation.goBack();
        return;
      }
      replaceRoute("/settings", { subTab: "budget" });
      return;
    }

    if (isSettingsDebtManagement) {
      if (navigation.canGoBack?.()) {
        navigation.goBack();
        return;
      }
      replaceRoute("/settings", { subTab: "budget" });
      return;
    }

    if (navigation.canGoBack?.()) {
      navigation.goBack();
    }
  };

  const goalsRightContent = isGoalsSection && !isGoalDetail ? (
    <View style={{ width: 36, height: 36 }} />
  ) : isGoalDetail ? <View style={{ width: 34, height: 34 }} /> : undefined;

  const incomeRightContent = isIncomeTab ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Pressable
        onPress={openAnalytics}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: T.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${T.cardAlt}66`,
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Open analytics"
      >
        <Ionicons name="stats-chart-outline" size={18} color={T.accent} />
      </Pressable>
    </View>
  ) : undefined;

  const loggedExpensesRightContent = isLoggedExpenses || isLoggedSearch ? <View style={{ width: 34, height: 34 }} /> : undefined;

  const notificationsInboxRightContent = isSettingsNotifications ? (
    <Pressable
      onPress={() => router.setParams({ notificationsInboxToken: String(Date.now()) })}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: T.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `${T.cardAlt}66`,
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Open recent notifications"
    >
      <Ionicons name="mail-unread-outline" size={18} color={T.accent} />
      {notificationUnreadCount > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 5,
            right: 6,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: T.red,
            borderWidth: 1,
            borderColor: T.card,
          }}
        />
      ) : null}
    </Pressable>
  ) : undefined;

  if (isDebtDetail || isExpenseDetail || (isIncomeMonth && incomeMonthManageActive)) {
    return null;
  }

  return (
    <TopHeader
      variant={isAnalyticsRoute ? "analytics" : "default"}
      onSettings={() => pushRoute("/settings")}
      onIncome={() => {}}
      onAnalytics={openAnalytics}
      onHelp={() => pushRoute("/help")}
      onNotifications={() => pushRoute("/settings", { initialTab: "notifications" })}
      leftVariant={isStandaloneSacrificeIncomeMonth || isAnalyticsRoute || isSettings || isSettingsProfileDetails || isSettingsIncomeSettings || isSettingsStrategy || isSettingsDebtManagement || isGoalDetail || isGoalsProjection || isCategoryExpenses || isLoggedExpenses || isLoggedSearch || isUnplannedExpense || isScanReceipt || isAnyDebtAnalytics ? "back" : "avatar"}
      onBack={handleBack}
      centerLabel={centerLabel}
      centerContent={incomeMonthSwitcher}
      rightContent={notificationsInboxRightContent ?? loggedExpensesRightContent ?? incomeRightContent ?? goalsRightContent}
      showIncomeAction={false}
      showHelpAction={isDashboardHome || isExpensesList}
      compactActionsMenu={isSettings || isSettingsProfileDetails || isSettingsIncomeSettings || isSettingsStrategy || isSettingsDebtManagement}
      showAnalyticsAction={!isSettings && !isSettingsProfileDetails && !isSettingsIncomeSettings && !isSettingsStrategy && !isSettingsDebtManagement && !isAnalyticsRoute && !isGoalDetail && !isDebtSplitSection && !isUnplannedExpense}
      showNotificationAction={!isSettings && !isSettingsProfileDetails && !isSettingsIncomeSettings && !isSettingsStrategy && !isSettingsDebtManagement && !isAnalyticsRoute}
      onLogout={undefined}
    />
  );
}