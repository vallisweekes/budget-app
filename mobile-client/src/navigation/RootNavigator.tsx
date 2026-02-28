import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import type {
  RootStackParamList,
  MainTabParamList,
  IncomeStackParamList,
  ExpensesStackParamList,
  DebtStackParamList,
} from "@/navigation/types";
import TopHeader from "@/components/Shared/TopHeader";
import PillTabBar from "@/components/Shared/PillTabBar";
import { T } from "@/lib/theme";
import { MONTH_NAMES_LONG } from "@/lib/formatting";
import { apiFetch } from "@/lib/api";
import type { IncomeSacrificeData, OnboardingStatusResponse } from "@/lib/apiTypes";

import LoginScreen from "@/screens/LoginScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import IncomeScreen from "@/screens/IncomeScreen";
import IncomeMonthScreen from "@/screens/IncomeMonthScreen";
import ExpensesScreen from "@/screens/ExpensesScreen";
import CategoryExpensesScreen from "@/screens/CategoryExpensesScreen";
import ExpenseDetailScreen from "@/screens/ExpenseDetailScreen";
import UnplannedExpenseScreen from "@/screens/UnplannedExpenseScreen";
import ScanReceiptScreen from "@/screens/ScanReceiptScreen";
import DebtScreen from "@/screens/DebtScreen";
import DebtDetailScreen from "@/screens/DebtDetailScreen";
import DebtAnalyticsScreen from "@/screens/DebtAnalyticsScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import PaymentsScreen from "@/screens/PaymentsScreen";
import GoalsScreen from "@/screens/GoalsScreen";
import GoalsProjectionScreen from "@/screens/GoalsProjectionScreen";
import AnalyticsScreen from "@/screens/AnalyticsScreen";
import SettingsStrategyScreen from "@/screens/SettingsStrategyScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const IncomeStack = createNativeStackNavigator<IncomeStackParamList>();
const ExpensesStack = createNativeStackNavigator<ExpensesStackParamList>();
const DebtStack = createNativeStackNavigator<DebtStackParamList>();

function IncomeStackNavigator() {
  return (
    <IncomeStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg } }}>
      <IncomeStack.Screen name="IncomeGrid" component={IncomeScreen} />
      <IncomeStack.Screen name="IncomeMonth" component={IncomeMonthScreen} />
    </IncomeStack.Navigator>
  );
}

function ExpensesStackNavigator() {
  return (
    <ExpensesStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg } }}>
      <ExpensesStack.Screen name="ExpensesList" component={ExpensesScreen} />
      <ExpensesStack.Screen name="CategoryExpenses" component={CategoryExpensesScreen} />
      <ExpensesStack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
      <ExpensesStack.Screen name="UnplannedExpense" component={UnplannedExpenseScreen} />
      <ExpensesStack.Screen name="ScanReceipt" component={ScanReceiptScreen} />
    </ExpensesStack.Navigator>
  );
}

function DebtStackNavigator() {
  return (
    <DebtStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg } }}>
      <DebtStack.Screen name="DebtList" component={DebtScreen} />
      <DebtStack.Screen name="DebtDetail" component={DebtDetailScreen} />
      <DebtStack.Screen name="DebtAnalytics" component={DebtAnalyticsScreen} />
    </DebtStack.Navigator>
  );
}

function NotificationSettingsScreen(props: unknown) {
  return <SettingsScreen {...(props as React.ComponentProps<typeof SettingsScreen>)} />;
}

function RootTopHeader({ navigation }: { navigation: any }) {
  const { signOut } = useAuth();
  const [incomePendingCount, setIncomePendingCount] = useState(0);
  const [pendingBudgetPlanId, setPendingBudgetPlanId] = useState<string | null>(null);
  const now = new Date();
  const nowMonth = now.getMonth() + 1;
  const nowYear = now.getFullYear();

  const getPendingCount = useCallback((data: IncomeSacrificeData): number => {
    const confirmed = new Set((data.confirmations ?? []).map((item) => item.targetKey));

    const amountForTarget = (targetKey: string): number => {
      if (targetKey.startsWith("fixed:")) {
        const field = targetKey.slice("fixed:".length) as keyof IncomeSacrificeData["fixed"];
        return Number(data.fixed?.[field] ?? 0);
      }
      if (targetKey.startsWith("custom:")) {
        const customId = targetKey.slice("custom:".length);
        const item = (data.customItems ?? []).find((row) => row.id === customId);
        return Number(item?.amount ?? 0);
      }
      return 0;
    };

    return (data.goalLinks ?? []).reduce((sum, link) => {
      if (confirmed.has(link.targetKey)) return sum;
      return amountForTarget(link.targetKey) > 0 ? sum + 1 : sum;
    }, 0);
  }, []);

  const loadPendingCount = useCallback(async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    try {
      const data = await apiFetch<IncomeSacrificeData>(`/api/bff/income-sacrifice?month=${month}&year=${year}`, {
        cacheTtlMs: 2_000,
      });
      setIncomePendingCount(getPendingCount(data));
      setPendingBudgetPlanId(typeof data.budgetPlanId === "string" && data.budgetPlanId.trim() ? data.budgetPlanId : null);
    } catch {
      setIncomePendingCount(0);
      setPendingBudgetPlanId(null);
    }
  }, [getPendingCount]);

  const getDeepestRoute = (state: any): any => {
    if (!state?.routes?.length) return null;
    const route = state.routes[state.index ?? state.routes.length - 1];
    if (route?.state) return getDeepestRoute(route.state);
    return route;
  };

  const deepestRoute = getDeepestRoute(navigation.getState?.());
  const isIncomeMonth = deepestRoute?.name === "IncomeMonth";
  const isIncomeGrid = deepestRoute?.name === "IncomeGrid";
  const isAnalytics = deepestRoute?.name === "Analytics";
  const isNotificationSettings = deepestRoute?.name === "NotificationSettings";
  const shouldShowIncomeBack = isIncomeMonth || isIncomeGrid || isAnalytics;

  const incomeGridYearParam = Number(deepestRoute?.params?.year);
  const incomeGridYear = Number.isFinite(incomeGridYearParam) ? incomeGridYearParam : new Date().getFullYear();

  const hasIncomeGridAddFlag = typeof deepestRoute?.params?.showAddAction === "boolean";
  const showIncomeGridAddAction = hasIncomeGridAddFlag ? Boolean(deepestRoute?.params?.showAddAction) : true;

  const incomeGridBudgetPlanId =
    typeof deepestRoute?.params?.budgetPlanId === "string" ? deepestRoute.params.budgetPlanId : "";

  const monthNum = Number(deepestRoute?.params?.month);
  const yearNum = Number(deepestRoute?.params?.year);
  const incomeMonthBudgetPlanId = typeof deepestRoute?.params?.budgetPlanId === "string"
    ? deepestRoute.params.budgetPlanId
    : "";
  const incomeMonthInitialMode = deepestRoute?.params?.initialMode === "sacrifice" ? "sacrifice" : "income";
  const monthLabel = isAnalytics
    ? "Analytics"
    : isIncomeMonth && Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12 && Number.isFinite(yearNum)
      ? `${MONTH_NAMES_LONG[monthNum - 1]} ${yearNum}`
      : undefined;

  const canUseMonthSwitcher = isIncomeMonth
    && Number.isFinite(monthNum)
    && monthNum >= 1
    && monthNum <= 12
    && Number.isFinite(yearNum)
    && Boolean(incomeMonthBudgetPlanId);

  const isIncomeMonthLocked = Number.isFinite(monthNum) && Number.isFinite(yearNum)
    ? (Number(yearNum) < nowYear || (Number(yearNum) === nowYear && Number(monthNum) < nowMonth))
    : false;

  const goToIncomeMonth = (nextMonth: number, nextYear: number) => {
    if (!incomeMonthBudgetPlanId) return;
    navigation.navigate("IncomeFlow", {
      screen: "IncomeMonth",
      params: {
        month: nextMonth,
        year: nextYear,
        budgetPlanId: incomeMonthBudgetPlanId,
        initialMode: incomeMonthInitialMode,
      },
    });
  };

  const prevMonth = Number(monthNum) - 1 < 1 ? 12 : Number(monthNum) - 1;
  const prevYear = Number(monthNum) - 1 < 1 ? Number(yearNum) - 1 : Number(yearNum);
  const nextMonth = Number(monthNum) + 1 > 12 ? 1 : Number(monthNum) + 1;
  const nextYear = Number(monthNum) + 1 > 12 ? Number(yearNum) + 1 : Number(yearNum);

  const prevIsPast = prevYear < nowYear || (prevYear === nowYear && prevMonth < nowMonth);
  const disablePrev = !canUseMonthSwitcher || prevIsPast;
  const disableNext = !canUseMonthSwitcher;

  const incomeMonthSwitcher = canUseMonthSwitcher ? (
    <View style={s.monthSwitchWrap}>
      <Pressable
        onPress={() => {
          if (disablePrev) return;
          goToIncomeMonth(prevMonth, prevYear);
        }}
        disabled={disablePrev}
        style={[s.monthSwitchBtn, disablePrev && s.monthSwitchBtnDisabled]}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={13} color={disablePrev ? T.textMuted : T.text} />
      </Pressable>

      <Text style={s.monthSwitchText}>{monthLabel}</Text>

      <Pressable
        onPress={() => {
          if (disableNext) return;
          goToIncomeMonth(nextMonth, nextYear);
        }}
        disabled={disableNext}
        style={[s.monthSwitchBtn, disableNext && s.monthSwitchBtnDisabled]}
        hitSlop={8}
      >
        <Ionicons name="chevron-forward" size={13} color={disableNext ? T.textMuted : T.text} />
      </Pressable>
    </View>
  ) : undefined;

  const handleBack = () => {
    if (isNotificationSettings) {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.navigate("Main", { screen: "Dashboard" });
      return;
    }

    if (isAnalytics) {
      navigation.goBack();
      return;
    }

    if (isIncomeMonth) {
      navigation.navigate("IncomeFlow", { screen: "IncomeGrid" });
      return;
    }

    if (isIncomeGrid && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Main");
  };

  const updateIncomeGridYear = (nextYear: number) => {
    navigation.navigate("IncomeFlow", {
      screen: "IncomeGrid",
      params: { year: nextYear },
    });
  };

  const incomeGridYearControl = isIncomeGrid ? (
    <View style={s.incomeYearWrap}>
      <Pressable onPress={() => updateIncomeGridYear(incomeGridYear - 1)} style={s.incomeYearBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={16} color={T.textDim} />
      </Pressable>
      <Text style={s.incomeYearText}>{incomeGridYear}</Text>
      <Pressable onPress={() => updateIncomeGridYear(incomeGridYear + 1)} style={s.incomeYearBtn} hitSlop={8}>
        <Ionicons name="chevron-forward" size={16} color={T.textDim} />
      </Pressable>
    </View>
  ) : undefined;

  const openIncomeGridAdd = () => {
    navigation.navigate("IncomeFlow", {
      screen: "IncomeGrid",
      params: {
        year: incomeGridYear,
        openYearIncomeSheetAt: Date.now(),
      },
    });
  };

  const incomeGridRightContent = isIncomeGrid
    ? showIncomeGridAddAction
      ? (
        <Pressable
          onPress={openIncomeGridAdd}
          disabled={!incomeGridBudgetPlanId}
          style={[s.headerActionBtn, s.headerActionBtnAdd, !incomeGridBudgetPlanId && s.headerActionBtnDisabled]}
          hitSlop={10}
        >
          <Ionicons name="add" size={19} color={T.onAccent} />
        </Pressable>
      )
      : (
        <>
          <Pressable onPress={() => navigation.navigate("Analytics")} style={s.headerActionBtn} hitSlop={10}>
            <Ionicons name="stats-chart-outline" size={18} color={T.accent} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate("NotificationSettings")} style={s.headerActionBtn} hitSlop={10}>
            <Ionicons name="notifications-outline" size={18} color={T.accent} />
          </Pressable>
        </>
      )
    : undefined;

  const analyticsRightContent = isAnalytics ? (
    <>
      <Pressable onPress={() => navigation.navigate("IncomeFlow")} style={s.headerActionBtn} hitSlop={10}>
        <Ionicons name="wallet-outline" size={18} color={T.accent} />
        {incomePendingCount > 0 ? (
          <View style={s.headerBadge}>
            <Text style={s.headerBadgeText}>{incomePendingCount > 9 ? "9+" : String(incomePendingCount)}</Text>
          </View>
        ) : null}
      </Pressable>
      <Pressable onPress={() => navigation.navigate("NotificationSettings")} style={s.headerActionBtn} hitSlop={10}>
        <Ionicons name="notifications-outline" size={18} color={T.accent} />
      </Pressable>
    </>
  ) : undefined;

  useEffect(() => {
    void loadPendingCount();
  }, [loadPendingCount, deepestRoute?.name]);

  const openIncome = () => {
    const now = new Date();
    if (incomePendingCount > 0 && pendingBudgetPlanId) {
      navigation.navigate("IncomeFlow", {
        screen: "IncomeMonth",
        params: {
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          budgetPlanId: pendingBudgetPlanId,
          initialMode: "sacrifice",
          pendingConfirmationsCount: incomePendingCount,
          showPendingNotice: true,
        },
      });
      return;
    }
    navigation.navigate("IncomeFlow");
  };

  const openAddIncomeFromHeader = () => {
    if (!isIncomeMonth || !incomeMonthBudgetPlanId || isIncomeMonthLocked) return;
    navigation.navigate("IncomeFlow", {
      screen: "IncomeMonth",
      params: {
        month: Number(monthNum),
        year: Number(yearNum),
        budgetPlanId: incomeMonthBudgetPlanId,
        initialMode: "income",
        openIncomeAddAt: Date.now(),
      },
    });
  };

  return (
    <TopHeader
      onSettings={() => navigation.navigate("NotificationSettings")}
      onIncome={openIncome}
      onAnalytics={() => navigation.navigate("Analytics")}
      onNotifications={() => navigation.navigate("NotificationSettings")}
      onBack={handleBack}
      centerContent={isIncomeMonth ? incomeMonthSwitcher : incomeGridYearControl}
      centerLabel={isIncomeMonth ? undefined : monthLabel}
      leftVariant={shouldShowIncomeBack || isNotificationSettings ? "back" : "avatar"}
      showIncomeAction={!isIncomeGrid && !isNotificationSettings && !isIncomeMonth}
      rightContent={analyticsRightContent ?? incomeGridRightContent}
      compactActionsMenu={isNotificationSettings || isIncomeMonth}
      onLogout={isNotificationSettings ? signOut : undefined}
      incomePendingCount={incomePendingCount}
      onAddIncome={isIncomeMonth ? openAddIncomeFromHeader : undefined}
    />
  );
}

const s = StyleSheet.create({
  quickActionBtn: {
    minWidth: 64,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: T.accentBorder,
  },
  quickActionText: {
    color: T.onAccent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  incomeYearWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: `${T.cardAlt}88`,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  incomeYearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  incomeYearText: {
    color: T.text,
    fontSize: 18,
    fontWeight: "600",
    minWidth: 56,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  monthSwitchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  monthSwitchBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  monthSwitchBtnDisabled: {
    opacity: 0.45,
  },
  monthSwitchText: {
    color: T.text,
    fontSize: 15,
    fontWeight: "700",
    minWidth: 118,
    paddingHorizontal: 1,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${T.cardAlt}66`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    position: "relative",
  },
  headerBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.red,
    borderWidth: 1,
    borderColor: T.card,
  },
  headerBadgeText: {
    color: T.onAccent,
    fontSize: 9,
    fontWeight: "900",
  },
  headerActionBtnAdd: {
    backgroundColor: T.accent,
    borderColor: T.accent,
  },
  headerActionBtnDisabled: {
    opacity: 0.5,
  },
});

function MainTabs() {
  const { signOut } = useAuth();
  const [incomePendingCount, setIncomePendingCount] = useState(0);
  const [pendingBudgetPlanId, setPendingBudgetPlanId] = useState<string | null>(null);

  const getPendingCount = useCallback((data: IncomeSacrificeData): number => {
    const confirmed = new Set((data.confirmations ?? []).map((item) => item.targetKey));

    const amountForTarget = (targetKey: string): number => {
      if (targetKey.startsWith("fixed:")) {
        const field = targetKey.slice("fixed:".length) as keyof IncomeSacrificeData["fixed"];
        return Number(data.fixed?.[field] ?? 0);
      }
      if (targetKey.startsWith("custom:")) {
        const customId = targetKey.slice("custom:".length);
        const item = (data.customItems ?? []).find((row) => row.id === customId);
        return Number(item?.amount ?? 0);
      }
      return 0;
    };

    return (data.goalLinks ?? []).reduce((sum, link) => {
      if (confirmed.has(link.targetKey)) return sum;
      return amountForTarget(link.targetKey) > 0 ? sum + 1 : sum;
    }, 0);
  }, []);

  const loadPendingCount = useCallback(async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    try {
      const data = await apiFetch<IncomeSacrificeData>(`/api/bff/income-sacrifice?month=${month}&year=${year}`, {
        cacheTtlMs: 2_000,
      });
      setIncomePendingCount(getPendingCount(data));
      setPendingBudgetPlanId(typeof data.budgetPlanId === "string" && data.budgetPlanId.trim() ? data.budgetPlanId : null);
    } catch {
      setIncomePendingCount(0);
      setPendingBudgetPlanId(null);
    }
  }, [getPendingCount]);

  useEffect(() => {
    void loadPendingCount();
  }, [loadPendingCount]);

  return (
    <Tab.Navigator
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerTransparent: true,
        headerStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        header: () => {
          const getDeepestRoute = (state: any): any => {
            if (!state?.routes?.length) return null;
            const route = state.routes[state.index ?? state.routes.length - 1];
            if (route?.state) return getDeepestRoute(route.state);
            return route;
          };

          const deepestRoute = getDeepestRoute(navigation.getState?.());
          const isDebtDetail = deepestRoute?.name === "DebtDetail";
          if (isDebtDetail) return null;

          const isCategoryExpenses = deepestRoute?.name === "CategoryExpenses";
          const isExpensesList = deepestRoute?.name === "ExpensesList";
          const isUnplannedExpense = deepestRoute?.name === "UnplannedExpense";
          const isScanReceipt = deepestRoute?.name === "ScanReceipt";
          const isSettings = deepestRoute?.name === "Settings";
          const categoryExpensesName = typeof deepestRoute?.params?.categoryName === "string"
            ? deepestRoute.params.categoryName
            : undefined;
          const expensesCenterLabel = isCategoryExpenses
            ? categoryExpensesName
            : isUnplannedExpense
              ? "Log Expense · Unplanned"
              : isScanReceipt
                ? "Upload Receipt"
                : undefined;

          const openIncome = () => {
            const now = new Date();
            if (incomePendingCount > 0 && pendingBudgetPlanId) {
              const params = {
                screen: "IncomeMonth",
                params: {
                  month: now.getMonth() + 1,
                  year: now.getFullYear(),
                  budgetPlanId: pendingBudgetPlanId,
                  initialMode: "sacrifice" as const,
                  pendingConfirmationsCount: incomePendingCount,
                  showPendingNotice: true,
                },
              };
              const parent = navigation.getParent();
              if (parent) {
                (parent as any).navigate("IncomeFlow", params);
                return;
              }
              (navigation as any).navigate("Income", params);
              return;
            }

            const parent = navigation.getParent();
            if (parent) {
              parent.navigate("IncomeFlow" as never);
              return;
            }
            navigation.navigate("Income");
          };

          const openAnalytics = () => {
            const parent = navigation.getParent();
            if (parent) {
              parent.navigate("Analytics" as never);
            }
          };

          const openNotifications = () => {
            const parent = navigation.getParent();
            if (parent) {
              parent.navigate("NotificationSettings" as never);
              return;
            }
            navigation.navigate("Settings");
          };

          const expensesListLeftContent = isExpensesList ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => navigation.navigate("Expenses" as any, { screen: "ScanReceipt" } as any)}
                style={s.quickActionBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Scan receipt"
              >
                <Ionicons name="camera" size={17} color={T.onAccent} />
                <Text style={s.quickActionText}>Scan</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate("Expenses" as any, { screen: "UnplannedExpense" } as any)}
                style={s.quickActionBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Log expense"
              >
                <Ionicons name="create-outline" size={17} color={T.onAccent} />
                <Text style={s.quickActionText}>Log</Text>
              </Pressable>
            </View>
          ) : undefined;

          return (
            <TopHeader
              onSettings={() => navigation.navigate("Settings")}
              onIncome={openIncome}
              onAnalytics={openAnalytics}
              onNotifications={openNotifications}
              leftVariant={isSettings || isCategoryExpenses || isUnplannedExpense || isScanReceipt ? "back" : "avatar"}
              onBack={isCategoryExpenses
                ? () => navigation.navigate("Expenses" as any, { screen: "ExpensesList" } as any)
                : isSettings
                  ? () => navigation.navigate("Dashboard")
                : isUnplannedExpense || isScanReceipt
                  ? () => navigation.navigate("Expenses" as any, { screen: "ExpensesList" } as any)
                  : undefined}
              centerLabel={expensesCenterLabel}
              leftContent={expensesListLeftContent}
              showIncomeAction={!isSettings}
              compactActionsMenu={isSettings}
              onLogout={signOut}
              incomePendingCount={incomePendingCount}
            />
          );
        },
        sceneContainerStyle: { backgroundColor: T.bg },
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.textDim,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          tabBarLabel: "Home",
        }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Debts"
        component={DebtStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flag-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Income"
        component={IncomeStackNavigator}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { token, isLoading } = useAuth();
  const [onboardingState, setOnboardingState] = useState<OnboardingStatusResponse | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const loadOnboarding = useCallback(async () => {
    if (!token) {
      setOnboardingState(null);
      return;
    }
    setOnboardingLoading(true);
    try {
      const data = await apiFetch<OnboardingStatusResponse>("/api/bff/onboarding", { cacheTtlMs: 0, skipOnUnauthorized: true });
      setOnboardingState(data);
    } catch {
      setOnboardingState({ required: false, completed: false, profile: null, occupations: [] });
    } finally {
      setOnboardingLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadOnboarding();
  }, [loadOnboarding]);

  if (isLoading || (token && onboardingLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: T.bg } }}>
      {token ? (
        onboardingState?.required ? (
          <Stack.Screen name="Onboarding">
            {() => (
              <OnboardingScreen
                initial={onboardingState}
                onCompleted={() => {
                  void loadOnboarding();
                }}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="IncomeFlow"
              component={IncomeStackNavigator}
              options={({ navigation }) => ({
                headerShown: true,
                headerTransparent: true,
                headerStyle: { backgroundColor: "transparent" },
                headerShadowVisible: false,
                header: () => <RootTopHeader navigation={navigation} />,
              })}
            />
            <Stack.Screen
              name="NotificationSettings"
              component={NotificationSettingsScreen}
              options={({ navigation }) => ({
                headerShown: true,
                headerTransparent: true,
                headerStyle: { backgroundColor: "transparent" },
                headerShadowVisible: false,
                header: () => <RootTopHeader navigation={navigation} />,
              })}
            />
            <Stack.Screen name="Payments" component={PaymentsScreen} />
            <Stack.Screen
              name="Analytics"
              component={AnalyticsScreen}
              options={({ navigation }) => ({
                headerShown: true,
                headerTransparent: true,
                headerStyle: { backgroundColor: "transparent" },
                headerShadowVisible: false,
                header: () => <RootTopHeader navigation={navigation} />,
              })}
            />
            <Stack.Screen name="Goals" component={GoalsScreen} />
            <Stack.Screen name="GoalsProjection" component={GoalsProjectionScreen} />
            <Stack.Screen name="SettingsStrategy" component={SettingsStrategyScreen} />
          </>
        )
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
