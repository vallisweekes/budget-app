import React from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";

import TopHeader from "@/components/Shared/TopHeader";
import { useActiveBudgetPlan } from "@/context/ActiveBudgetPlanContext";
import { useAuth } from "@/context/AuthContext";
import { markSkipExpensesFocusReload } from "@/lib/helpers/expensesFocusReload";
import { subscribeNotificationInbox } from "@/lib/notificationInbox";
import { T } from "@/lib/theme";
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
  const router = useRouter();
  const navigation = useNavigation<any>();
  const segments = useSegments() as string[];
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const { profile, signOut } = useAuth();
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
  const isSettings = rootSegment === "settings";
  const isSettingsProfileDetails = rootSegment === "settings-profile-details";
  const isSettingsIncomeSettings = rootSegment === "settings-income-settings";
  const isSettingsStrategy = rootSegment === "settings-strategy";
  const isSettingsDebtManagement = rootSegment === "settings-debt-management";
  const isGoals = tabSegment === "goals";
  const isGoalsProjection = tabSegment === "goals-projection";
  const isGoalsSection = isGoals || isGoalsProjection;
  const isGoalsRootRoute = isGoals && !leafSegment;
  const isIncomeTab = tabSegment === "income";
  const isDashboardHome = tabSegment === "dashboard" && !leafSegment;
  const isGoalDetail = leafSegment === "GoalDetail";
  const isCategoryExpenses = leafSegment === "CategoryExpenses";
  const isDebtDetail = leafSegment === "DebtDetail";
  const isExpenseDetail = leafSegment === "ExpenseDetail";
  const isLoggedExpenses = leafSegment === "LoggedExpenses";
  const isExpensesList = leafSegment === "ExpensesList";
  const isUnplannedExpense = leafSegment === "UnplannedExpense";
  const isScanReceipt = leafSegment === "ScanReceipt";
  const isDebtAnalytics = leafSegment === "DebtAnalytics";
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

  if (isDebtDetail || isExpenseDetail) {
    return null;
  }

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

  const isSelectedPersonalPlan = activeBudgetPlanId === bootstrapBudgetPlanId;
  const isPersonalPlanParam = getStringParam(params.isPersonalPlan);
  const isPersonalPlan = isPersonalPlanParam === "true"
    ? true
    : isPersonalPlanParam === "false"
      ? false
      : isSelectedPersonalPlan;

  const currentPeriodMonth = getNumberParam(params.currentPeriodMonth);
  const currentPeriodYear = getNumberParam(params.currentPeriodYear);
  const hasResolvedCurrentPeriod = Number.isFinite(currentPeriodMonth)
    && currentPeriodMonth >= 1
    && currentPeriodMonth <= 12
    && Number.isFinite(currentPeriodYear);
  const resolvedCurrentPeriodMonth = hasResolvedCurrentPeriod ? Math.floor(currentPeriodMonth) : null;
  const resolvedCurrentPeriodYear = hasResolvedCurrentPeriod ? Math.floor(currentPeriodYear) : null;
  const hasResolvedSelectedPeriod = Number.isFinite(monthNum)
    && monthNum >= 1
    && monthNum <= 12
    && Number.isFinite(yearNum);
  const resolvedSelectedPeriodMonth = hasResolvedSelectedPeriod ? Math.floor(monthNum) : null;
  const resolvedSelectedPeriodYear = hasResolvedSelectedPeriod ? Math.floor(yearNum) : null;
  const isPastExpensesPeriod = isExpensesList
    && hasResolvedCurrentPeriod
    && hasResolvedSelectedPeriod
    && (
      (resolvedSelectedPeriodYear as number) < (resolvedCurrentPeriodYear as number)
      || (
        (resolvedSelectedPeriodYear as number) === (resolvedCurrentPeriodYear as number)
        && (resolvedSelectedPeriodMonth as number) < (resolvedCurrentPeriodMonth as number)
      )
    );

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
    : isLoggedExpenses
      ? "Logged expense"
      : isUnplannedExpense
        ? "Log Expense"
        : isScanReceipt
          ? "Upload Receipt"
          : isDebtAnalytics
            ? "Debt Analytics"
            : isSettingsProfileDetails
              ? "Profile details"
            : isSettingsIncomeSettings
              ? "Income settings"
            : isSettingsStrategy
              ? "Strategy"
            : isSettingsDebtManagement
              ? "Debt management"
            : isAnalytics
              ? "Analytics"
              : isSettings && settingsSubTab === "savings"
                ? "Money"
              : isSettings && settingsSubTab === "plans"
                ? "Plans"
              : isSettings && settingsSubTab === "locale"
                ? "Locale & Currency"
              : isSettings && settingsSubTab === "notifications"
                ? "Notifications"
              : isSettings && settingsSubTab === "budget"
                ? "Budget"
              : isSettings && settingsSubTab === "subscription"
                ? "Subscription"
              : isGoalDetail
                ? getStringParam(params.goalTitle) ?? (typeof routeParams?.goalTitle === "string" ? routeParams.goalTitle : "Goal")
              : isGoalsProjection
                ? "Projection"
              : isGoals
                ? "Goals"
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

  const analyticsOverviewMode = getStringParam(params.overviewMode) === "month" ? "month" : "year";

  const handleBack = () => {
    if (isStandaloneSacrificeIncomeMonth && Number.isFinite(monthNum) && Number.isFinite(yearNum) && incomeMonthBudgetPlanId) {
      replaceRoute("/(tabs)/income/IncomeMonth", {
        month: Math.floor(monthNum),
        year: Math.floor(yearNum),
        budgetPlanId: incomeMonthBudgetPlanId,
        initialMode: "income",
      });
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

    if (isDebtAnalytics) {
      replaceRoute("/(tabs)/debts/DebtList");
      return;
    }

    if (isAnalytics) {
      if (navigation.canGoBack?.()) {
        navigation.goBack();
        return;
      }
      replaceRoute("/(tabs)/dashboard");
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

  const analyticsRightContent = isAnalytics ? (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(244,246,255,0.10)",
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.05)",
        width: 74,
        height: 38,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 34,
          height: 32,
          borderRadius: 16,
          backgroundColor: T.accent,
          top: 2,
          transform: [{ translateX: analyticsOverviewMode === "year" ? 38 : 2 }],
        }}
      />
      <Pressable onPress={() => router.setParams({ overviewMode: "month" })} style={{ flex: 1, alignItems: "center", justifyContent: "center" }} hitSlop={10}>
        <Text style={{ color: analyticsOverviewMode === "month" ? T.onAccent : T.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 0.2 }}>M</Text>
      </Pressable>
      <Pressable onPress={() => router.setParams({ overviewMode: "year" })} style={{ flex: 1, alignItems: "center", justifyContent: "center" }} hitSlop={10}>
        <Text style={{ color: analyticsOverviewMode === "year" ? T.onAccent : T.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 0.2 }}>Y</Text>
      </Pressable>
    </View>
  ) : undefined;

  const incomeRightContent = isIncomeTab ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Pressable
        onPress={() => pushRoute("/analytics")}
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

  const expensesListLeftContent = isExpensesList && isPersonalPlan && !isPastExpensesPeriod ? (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Pressable
        onPress={() => {
          pushRoute("/(tabs)/expenses/UnplannedExpense", {
            month: resolvedCurrentPeriodMonth ?? undefined,
            year: resolvedCurrentPeriodYear ?? undefined,
          });
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Log expense"
        style={{
          minWidth: 68,
          height: 34,
          borderRadius: 17,
          backgroundColor: T.accent,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
          gap: 4,
        }}
      >
        <Ionicons name="create-outline" size={17} color={T.onAccent} />
        <Text style={{ color: T.onAccent, fontSize: 13, fontWeight: "800" }}>Log</Text>
      </Pressable>
    </View>
  ) : undefined;

  const expensesListLoggedExpensesCount = Number.isFinite(getNumberParam(params.loggedExpensesCount))
    ? Math.max(0, Math.floor(getNumberParam(params.loggedExpensesCount)))
    : 0;

  const expensesLoggedRightContent = isExpensesList && isPersonalPlan && !isPastExpensesPeriod ? (
    <Pressable
      onPress={() => {
        pushRoute("/(tabs)/expenses/LoggedExpenses", {
          categoryName: "All categories",
          month: resolvedCurrentPeriodMonth ?? undefined,
          year: resolvedCurrentPeriodYear ?? undefined,
          budgetPlanId: getStringParam(params.budgetPlanId),
          currency: getStringParam(params.currency) ?? "£",
        });
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Open logged expenses"
      style={{
        minWidth: 88,
        height: 34,
        borderRadius: 17,
        backgroundColor: T.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
        gap: 4,
      }}
    >
      <Ionicons name="list-outline" size={14} color={T.onAccent} />
      <Text style={{ color: T.onAccent, fontSize: 12, fontWeight: "800" }}>Logged</Text>
      {expensesListLoggedExpensesCount > 0 ? (
        <View
          style={{
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: `${T.onAccent}22`,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 6,
          }}
        >
          <Text style={{ color: T.onAccent, fontSize: 11, fontWeight: "900" }}>
            {expensesListLoggedExpensesCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  ) : undefined;

  const loggedExpensesRightContent = isLoggedExpenses ? (
    <Pressable
      onPress={() => {
        pushRoute("/(tabs)/expenses/UnplannedExpense", {
          month: Number.isFinite(monthNum) ? Math.floor(monthNum) : (resolvedCurrentPeriodMonth ?? undefined),
          year: Number.isFinite(yearNum) ? Math.floor(yearNum) : (resolvedCurrentPeriodYear ?? undefined),
        });
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Log expense"
      style={{
        minWidth: 68,
        height: 34,
        borderRadius: 17,
        backgroundColor: T.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 12,
        gap: 4,
      }}
    >
      <Ionicons name="create-outline" size={17} color={T.onAccent} />
      <Text style={{ color: T.onAccent, fontSize: 13, fontWeight: "800" }}>Log</Text>
    </Pressable>
  ) : undefined;

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

  if (isIncomeMonth && incomeMonthManageActive) {
    return null;
  }

  return (
    <TopHeader
      variant={isAnalytics ? "analytics" : "default"}
      onSettings={() => pushRoute("/settings")}
      onIncome={() => {}}
      onAnalytics={() => pushRoute("/analytics")}
      onHelp={() => pushRoute("/help")}
      onNotifications={() => pushRoute("/settings", { initialTab: "notifications" })}
      leftContent={expensesListLeftContent}
      leftVariant={isStandaloneSacrificeIncomeMonth || isAnalytics || isSettings || isSettingsProfileDetails || isSettingsIncomeSettings || isSettingsStrategy || isSettingsDebtManagement || isGoalDetail || isCategoryExpenses || isLoggedExpenses || isUnplannedExpense || isScanReceipt || isDebtAnalytics ? "back" : "avatar"}
      onBack={handleBack}
      centerLabel={centerLabel}
      centerContent={incomeMonthSwitcher}
      rightContent={notificationsInboxRightContent ?? loggedExpensesRightContent ?? analyticsRightContent ?? incomeRightContent ?? expensesLoggedRightContent ?? goalsRightContent}
      showIncomeAction={false}
      showHelpAction={isDashboardHome}
      compactActionsMenu={isSettings || isSettingsProfileDetails || isSettingsIncomeSettings || isSettingsStrategy || isSettingsDebtManagement}
      showAnalyticsAction={!isSettings && !isSettingsProfileDetails && !isSettingsIncomeSettings && !isSettingsStrategy && !isSettingsDebtManagement && !isAnalytics && !isGoalDetail}
      showNotificationAction={!isSettings && !isSettingsProfileDetails && !isSettingsIncomeSettings && !isSettingsStrategy && !isSettingsDebtManagement && !isAnalytics}
      onLogout={isSettings && !isSettingsNotifications ? signOut : undefined}
    />
  );
}