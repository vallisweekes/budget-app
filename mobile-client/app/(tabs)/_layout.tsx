import React from "react";
import { Ionicons, Octicons } from "@expo/vector-icons";
import { StackActions } from "@react-navigation/native";
import { Animated, Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { useRouter } from "expo-router";

import PillTabBar from "@/components/Shared/PillTabBar";
import TopHeader from "@/components/Shared/TopHeader";
import { useActiveBudgetPlan } from "@/context/ActiveBudgetPlanContext";
import { useAuth } from "@/context/AuthContext";
import { markSkipExpensesFocusReload } from "@/lib/helpers/expensesFocusReload";
import { T } from "@/lib/theme";

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatIncomePeriodSpan(month: number): string {
  const safeMonth = Math.max(1, Math.min(12, month));
  const start = MONTH_NAMES_SHORT[(safeMonth - 2 + 12) % 12];
  const end = MONTH_NAMES_SHORT[(safeMonth - 1) % 12];
  return `${start} - ${end}`;
}

function getDeepestRoute(state: any): any {
  if (!state?.routes?.length) return null;
  const route = state.routes[state.index ?? state.routes.length - 1];
  if (route?.state) return getDeepestRoute(route.state);
  return route;
}

function getRouteBaseName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.split("/")[0] ?? "";
}

function TabsHeader({ navigation, route }: { navigation: any; route: any }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const { activeBudgetPlanId, bootstrapBudgetPlanId } = useActiveBudgetPlan();
  const navigationState = navigation.getState?.();
  const deepestRoute = getDeepestRoute(navigationState) ?? route;
  const currentTabName = getRouteBaseName(route?.name);

  const findTabRouteName = (baseName: string) => {
    const routes = Array.isArray(navigationState?.routes) ? navigationState.routes : [];
    const match = routes.find((entry: { name?: string }) => getRouteBaseName(entry?.name) === baseName);
    return typeof match?.name === "string" ? match.name : null;
  };

  const navigateToTab = (baseName: string, params?: Record<string, unknown>) => {
    const routeName = findTabRouteName(baseName);
    if (!routeName) return false;
    navigation.navigate(routeName, params);
    return true;
  };

  const popCurrentTabStack = () => {
    const routes = Array.isArray(navigationState?.routes) ? navigationState.routes : [];
    const currentTabRoute = routes.find((entry: { name?: string }) => getRouteBaseName(entry?.name) === currentTabName) as { state?: { index?: number; key?: string } } | undefined;
    const stackKey = currentTabRoute?.state?.key;
    const stackIndex = Number(currentTabRoute?.state?.index);
    if (!stackKey || !Number.isFinite(stackIndex) || stackIndex <= 0) return false;
    navigation.dispatch({
      ...StackActions.pop(1),
      target: stackKey,
    });
    return true;
  };

  const isCategoryExpenses = deepestRoute?.name === "CategoryExpenses";
  const isDebtDetail = deepestRoute?.name === "DebtDetail";
  const isExpenseDetail = deepestRoute?.name === "ExpenseDetail";
  const isAnalytics = currentTabName === "analytics";
  const isLoggedExpenses = deepestRoute?.name === "LoggedExpenses";
  const isExpensesList = deepestRoute?.name === "ExpensesList";
  const isUnplannedExpense = deepestRoute?.name === "UnplannedExpense";
  const isScanReceipt = deepestRoute?.name === "ScanReceipt";
  const isDebtAnalytics = deepestRoute?.name === "DebtAnalytics";
  const isIncomeTab = currentTabName === "income";
  const isSettings = currentTabName === "settings";
  const isGoals = currentTabName === "goals";
  const nestedTarget = route?.params && typeof route.params === "object"
    ? (route.params as { screen?: unknown; params?: unknown })
    : null;
  const nestedIncomeMonthParams = nestedTarget?.screen === "IncomeMonth" && nestedTarget?.params && typeof nestedTarget.params === "object"
    ? (nestedTarget.params as Record<string, unknown>)
    : null;
  const activeIncomeParams = deepestRoute?.name === "IncomeMonth"
    ? deepestRoute?.params
    : nestedIncomeMonthParams;
  const monthNum = Number(activeIncomeParams?.month);
  const yearNum = Number(activeIncomeParams?.year);
  const incomeMonthBudgetPlanId = typeof activeIncomeParams?.budgetPlanId === "string"
    ? activeIncomeParams.budgetPlanId
    : "";
  const incomeMonthInitialMode = activeIncomeParams?.initialMode === "sacrifice" ? "sacrifice" : "income";
  const canUseIncomeMonthSwitcher = isIncomeTab
    && Number.isFinite(monthNum)
    && monthNum >= 1
    && monthNum <= 12
    && Number.isFinite(yearNum)
    && Boolean(incomeMonthBudgetPlanId);
  const isSelectedPersonalPlan = activeBudgetPlanId === bootstrapBudgetPlanId;
  const isPersonalPlan = typeof deepestRoute?.params?.isPersonalPlan === "boolean"
    ? deepestRoute.params.isPersonalPlan
    : isSelectedPersonalPlan;
  const currentPeriodMonth = Number(deepestRoute?.params?.currentPeriodMonth);
  const currentPeriodYear = Number(deepestRoute?.params?.currentPeriodYear);
  const resolvedCurrentPeriodMonth = Number.isFinite(currentPeriodMonth) && currentPeriodMonth >= 1 && currentPeriodMonth <= 12
    ? Math.floor(currentPeriodMonth)
    : new Date().getMonth() + 1;
  const resolvedCurrentPeriodYear = Number.isFinite(currentPeriodYear)
    ? Math.floor(currentPeriodYear)
    : new Date().getFullYear();
  const selectedPeriodMonth = Number(deepestRoute?.params?.month);
  const selectedPeriodYear = Number(deepestRoute?.params?.year);
  const resolvedSelectedPeriodMonth = Number.isFinite(selectedPeriodMonth) && selectedPeriodMonth >= 1 && selectedPeriodMonth <= 12
    ? Math.floor(selectedPeriodMonth)
    : resolvedCurrentPeriodMonth;
  const resolvedSelectedPeriodYear = Number.isFinite(selectedPeriodYear)
    ? Math.floor(selectedPeriodYear)
    : resolvedCurrentPeriodYear;
  const isPastExpensesPeriod = isExpensesList
    && (
      resolvedSelectedPeriodYear < resolvedCurrentPeriodYear
      || (resolvedSelectedPeriodYear === resolvedCurrentPeriodYear && resolvedSelectedPeriodMonth < resolvedCurrentPeriodMonth)
    );

  const categoryExpensesName = typeof deepestRoute?.params?.categoryName === "string"
    ? deepestRoute.params.categoryName
    : undefined;
  const categoryExpensesMonth = Number(deepestRoute?.params?.month);
  const categoryExpensesYear = Number(deepestRoute?.params?.year);
  const hasCategoryMonthYear = Number.isFinite(categoryExpensesMonth)
    && categoryExpensesMonth >= 1
    && categoryExpensesMonth <= 12
    && Number.isFinite(categoryExpensesYear);
  const expensesListMonth = Number(deepestRoute?.params?.month);
  const expensesListYear = Number(deepestRoute?.params?.year);

  const centerLabel = isCategoryExpenses
    ? categoryExpensesName ?? "Category"
    : isLoggedExpenses
      ? "Logged expense"
      : isUnplannedExpense
        ? "Log Expense"
        : isScanReceipt
          ? "Upload Receipt"
          : isDebtAnalytics
            ? "Debt Analytics"
            : isAnalytics
              ? "Analytics"
            : isGoals
              ? "Goals"
              : undefined;
  const incomeMonthSwitcher = canUseIncomeMonthSwitcher ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable
        onPress={() => {
          const previousMonth = Number(monthNum) - 1 < 1 ? 12 : Number(monthNum) - 1;
          const previousYear = Number(monthNum) - 1 < 1 ? Number(yearNum) - 1 : Number(yearNum);
          navigateToTab("income", {
            screen: "IncomeMonth",
            params: {
              month: previousMonth,
              year: previousYear,
              budgetPlanId: incomeMonthBudgetPlanId,
              initialMode: incomeMonthInitialMode,
            },
          });
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Previous income period"
        style={{ paddingHorizontal: 2, paddingVertical: 2, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="chevron-back" size={18} color={T.text} />
      </Pressable>
      <Text style={{ color: T.text, fontSize: 16, fontWeight: "700", minWidth: 118, textAlign: "center" }}>
        {formatIncomePeriodSpan(Number(monthNum))}
      </Text>
      <Pressable
        onPress={() => {
          const nextMonth = Number(monthNum) + 1 > 12 ? 1 : Number(monthNum) + 1;
          const nextYear = Number(monthNum) + 1 > 12 ? Number(yearNum) + 1 : Number(yearNum);
          navigateToTab("income", {
            screen: "IncomeMonth",
            params: {
              month: nextMonth,
              year: nextYear,
              budgetPlanId: incomeMonthBudgetPlanId,
              initialMode: incomeMonthInitialMode,
            },
          });
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Next income period"
        style={{ paddingHorizontal: 2, paddingVertical: 2, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="chevron-forward" size={18} color={T.text} />
      </Pressable>
    </View>
  ) : undefined;
  const analyticsOverviewMode = deepestRoute?.params?.overviewMode === "month" ? "month" : "year";

  const handleBack = () => {
    if (isLoggedExpenses) {
      if (deepestRoute?.params?.categoryId) {
        if (!navigateToTab("expenses", {
          screen: "CategoryExpenses",
          params: {
            categoryId: deepestRoute.params.categoryId,
            categoryName: deepestRoute.params.categoryName,
            color: deepestRoute.params.color ?? null,
            icon: deepestRoute.params.icon ?? null,
            month: Number(deepestRoute.params.month),
            year: Number(deepestRoute.params.year),
            budgetPlanId: deepestRoute.params.budgetPlanId ?? null,
            currency: deepestRoute.params.currency,
            skipFocusReloadAt: Date.now(),
          },
        })) {
          router.replace("/(tabs)/expenses");
        }
        return;
      }

      if (!navigateToTab("expenses", {
        screen: "ExpensesList",
        params: {
          month: Number(deepestRoute?.params?.month),
          year: Number(deepestRoute?.params?.year),
          budgetPlanId: deepestRoute?.params?.budgetPlanId ?? null,
          currency: deepestRoute?.params?.currency ?? "£",
          skipFocusReloadAt: Date.now(),
        },
      })) {
        router.replace("/(tabs)/expenses");
      }
      return;
    }

    if (isCategoryExpenses) {
      markSkipExpensesFocusReload();
      if (!navigateToTab("expenses", {
        screen: "ExpensesList",
        params: hasCategoryMonthYear
          ? {
            month: categoryExpensesMonth,
            year: categoryExpensesYear,
            skipFocusReloadAt: Date.now(),
          }
          : {
            skipFocusReloadAt: Date.now(),
          },
      })) {
        if (popCurrentTabStack()) {
          return;
        }
        if (navigation.canGoBack?.()) {
          navigation.goBack();
          return;
        }
        if (!navigateToTab("expenses", {
          screen: "ExpensesList",
          params: hasCategoryMonthYear
            ? {
              month: categoryExpensesMonth,
              year: categoryExpensesYear,
              skipFocusReloadAt: Date.now(),
            }
            : {
              skipFocusReloadAt: Date.now(),
            },
        })) {
          router.replace("/(tabs)/expenses");
        }
      }
      return;
    }

    if (isUnplannedExpense || isScanReceipt) {
      if (!navigateToTab("expenses", {
        screen: "ExpensesList",
        params: {
          month: Number.isFinite(expensesListMonth) ? expensesListMonth : undefined,
          year: Number.isFinite(expensesListYear) ? expensesListYear : undefined,
          skipFocusReloadAt: Date.now(),
        },
      })) {
        router.replace("/(tabs)/expenses");
      }
      return;
    }

    if (isDebtAnalytics) {
      if (!navigateToTab("debts", { screen: "DebtList" })) {
        router.replace("/(tabs)/debts");
      }
      return;
    }

    if (isAnalytics) {
      if (navigation.canGoBack?.()) {
        navigation.goBack();
        return;
      }
      router.replace("/(tabs)/dashboard");
      return;
    }

    if (isSettings) {
      if (!navigateToTab("dashboard")) {
        router.replace("/(tabs)/dashboard");
      }
      return;
    }

    if (navigation.canGoBack?.()) {
      navigation.goBack();
    }
  };

  const goalsRightContent = isGoals ? (
    <Pressable
      onPress={() => navigation.setParams?.({ openAddToken: Date.now() })}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Add goal"
      style={{
        minWidth: 72,
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
      <Ionicons name="add" size={18} color={T.onAccent} />
      <Text style={{ color: T.onAccent, fontSize: 13, fontWeight: "800" }}>Goal</Text>
    </Pressable>
  ) : undefined;

  const analyticsRightContent = isAnalytics ? (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 999,
        backgroundColor: `${T.cardAlt}66`,
        width: 68,
        height: 34,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 30,
          height: 28,
          borderRadius: 14,
          backgroundColor: T.accent,
          top: 2,
          transform: [{ translateX: analyticsOverviewMode === "year" ? 34 : 2 }],
        }}
      />
      <Pressable onPress={() => navigation.setParams?.({ overviewMode: "month" })} style={{ flex: 1, alignItems: "center", justifyContent: "center" }} hitSlop={10}>
        <Text style={{ color: analyticsOverviewMode === "month" ? T.onAccent : T.textDim, fontSize: 12, fontWeight: "800" }}>M</Text>
      </Pressable>
      <Pressable onPress={() => navigation.setParams?.({ overviewMode: "year" })} style={{ flex: 1, alignItems: "center", justifyContent: "center" }} hitSlop={10}>
        <Text style={{ color: analyticsOverviewMode === "year" ? T.onAccent : T.textDim, fontSize: 12, fontWeight: "800" }}>Y</Text>
      </Pressable>
    </View>
  ) : undefined;

  const expensesListLeftContent = isExpensesList && isPersonalPlan && !isPastExpensesPeriod ? (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Pressable
        onPress={() => {
          if (!navigateToTab("expenses", {
            screen: "UnplannedExpense",
            params: {
              month: resolvedCurrentPeriodMonth,
              year: resolvedCurrentPeriodYear,
            },
          })) {
            router.push("/(tabs)/expenses");
          }
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

  const expensesListLoggedExpensesCount = Number.isFinite(Number(deepestRoute?.params?.loggedExpensesCount))
    ? Math.max(0, Math.floor(Number(deepestRoute?.params?.loggedExpensesCount)))
    : 0;

  const expensesLoggedRightContent = isExpensesList && isPersonalPlan && !isPastExpensesPeriod ? (
    <Pressable
      onPress={() => {
        if (!navigateToTab("expenses", {
          screen: "LoggedExpenses",
          params: {
            categoryId: null,
            categoryName: "All categories",
            color: null,
            icon: null,
            month: resolvedCurrentPeriodMonth,
            year: resolvedCurrentPeriodYear,
            budgetPlanId: deepestRoute?.params?.budgetPlanId ?? null,
            currency: deepestRoute?.params?.currency ?? "£",
          },
        })) {
          router.push("/(tabs)/expenses");
        }
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
        if (!navigateToTab("expenses", {
          screen: "UnplannedExpense",
          params: {
            month: Number.isFinite(Number(deepestRoute?.params?.month))
              ? Math.floor(Number(deepestRoute?.params?.month))
              : resolvedCurrentPeriodMonth,
            year: Number.isFinite(Number(deepestRoute?.params?.year))
              ? Math.floor(Number(deepestRoute?.params?.year))
              : resolvedCurrentPeriodYear,
          },
        })) {
          router.push("/(tabs)/expenses");
        }
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

  if (isDebtDetail || isExpenseDetail) {
    return null;
  }

  return (
    <TopHeader
      onSettings={() => {
        if (!navigateToTab("settings")) {
          router.push("/(tabs)/settings");
        }
      }}
      onIncome={() => {
        if (!navigateToTab("income")) {
          router.push("/(tabs)/income");
        }
      }}
      onAnalytics={() => router.push("/(tabs)/analytics")}
      onNotifications={() => {
        if (!navigateToTab("settings")) {
          router.push("/(tabs)/settings");
        }
      }}
      leftContent={expensesListLeftContent}
      leftVariant={isSettings || isCategoryExpenses || isLoggedExpenses || isUnplannedExpense || isScanReceipt || isDebtAnalytics ? "back" : "avatar"}
      onBack={handleBack}
      centerLabel={centerLabel}
      centerContent={incomeMonthSwitcher}
      rightContent={loggedExpensesRightContent ?? analyticsRightContent ?? expensesLoggedRightContent ?? goalsRightContent}
      showIncomeAction={false}
      compactActionsMenu={isSettings}
      showAnalyticsAction={!isSettings && !isAnalytics}
      showNotificationAction={!isSettings && !isAnalytics}
      onLogout={isSettings ? signOut : undefined}
    />
  );
}

export default function MainTabsLayout() {
  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={({ navigation, route }) => ({
        headerShown: true,
        headerTransparent: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "transparent" },
        header: () => <TabsHeader navigation={navigation} route={route} />,
        animation: "none",
        lazy: true,
      })}
      tabBar={(props) => <PillTabBar {...props} />}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="debts"
        options={{
          title: "Debts",
          tabBarIcon: ({ color, size }) => <Ionicons name="card-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="income"
        options={{
          title: "Income",
          tabBarLabel: "Income",
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Goals",
          tabBarIcon: ({ color, size }) => <Octicons name="goal" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          href: null,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          href: null,
        }}
      />
    </Tabs>
  );
}