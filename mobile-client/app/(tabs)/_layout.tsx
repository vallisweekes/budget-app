import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import { StackActions } from "@react-navigation/native";
import { Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { useRouter } from "expo-router";

import PillTabBar from "@/components/Shared/PillTabBar";
import TopHeader from "@/components/Shared/TopHeader";
import { useActiveBudgetPlan } from "@/context/ActiveBudgetPlanContext";
import { useAuth } from "@/context/AuthContext";
import { markSkipExpensesFocusReload } from "@/lib/helpers/expensesFocusReload";
import { T } from "@/lib/theme";

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

  const resetCurrentTabStack = (screen: string, params?: Record<string, unknown>) => {
    const routes = Array.isArray(navigationState?.routes) ? navigationState.routes : [];
    const currentTabRoute = routes.find((entry: { name?: string }) => getRouteBaseName(entry?.name) === currentTabName) as { state?: { key?: string } } | undefined;
    const stackKey = currentTabRoute?.state?.key;
    if (!stackKey) return false;
    navigation.dispatch({
      ...CommonActions.reset({
        index: 0,
        routes: [{ name: screen, params }],
      }),
      target: stackKey,
    });
    return true;
  };

  const isCategoryExpenses = deepestRoute?.name === "CategoryExpenses";
  const isLoggedExpenses = deepestRoute?.name === "LoggedExpenses";
  const isExpensesList = deepestRoute?.name === "ExpensesList";
  const isUnplannedExpense = deepestRoute?.name === "UnplannedExpense";
  const isScanReceipt = deepestRoute?.name === "ScanReceipt";
  const isDebtAnalytics = deepestRoute?.name === "DebtAnalytics";
  const isSettings = currentTabName === "settings";
  const isGoals = currentTabName === "goals";
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
            : isGoals
              ? "Goals"
              : undefined;

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
      if (popCurrentTabStack()) {
        return;
      }
      if (resetCurrentTabStack(
        "ExpensesList",
        hasCategoryMonthYear
          ? {
            month: categoryExpensesMonth,
            year: categoryExpensesYear,
            skipFocusReloadAt: Date.now(),
          }
          : {
            skipFocusReloadAt: Date.now(),
          },
      )) {
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

  const expensesListLeftContent = isExpensesList && isPersonalPlan ? (
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

  const expensesLoggedRightContent = isExpensesList && isPersonalPlan ? (
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
      onAnalytics={() => router.push("/(modals)/analytics")}
      onNotifications={() => {
        if (!navigateToTab("settings")) {
          router.push("/(tabs)/settings");
        }
      }}
      leftContent={expensesListLeftContent}
      leftVariant={isSettings || isCategoryExpenses || isLoggedExpenses || isUnplannedExpense || isScanReceipt || isDebtAnalytics ? "back" : "avatar"}
      onBack={handleBack}
      centerLabel={centerLabel}
      rightContent={expensesLoggedRightContent ?? goalsRightContent}
      showIncomeAction={false}
      compactActionsMenu={isSettings}
      showAnalyticsAction={!isSettings}
      showNotificationAction={!isSettings}
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
          tabBarIcon: ({ color, size }) => <Ionicons name="flag-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          href: null,
        }}
      />
    </Tabs>
  );
}