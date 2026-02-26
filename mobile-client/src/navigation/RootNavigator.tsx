import React from "react";
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

import LoginScreen from "@/screens/LoginScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import IncomeScreen from "@/screens/IncomeScreen";
import IncomeMonthScreen from "@/screens/IncomeMonthScreen";
import ExpensesScreen from "@/screens/ExpensesScreen";
import CategoryExpensesScreen from "@/screens/CategoryExpensesScreen";
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
  const monthLabel = isAnalytics
    ? "Analytics"
    : isIncomeMonth && Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12 && Number.isFinite(yearNum)
      ? `${MONTH_NAMES_LONG[monthNum - 1]} ${yearNum}`
      : undefined;

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
      </Pressable>
      <Pressable onPress={() => navigation.navigate("NotificationSettings")} style={s.headerActionBtn} hitSlop={10}>
        <Ionicons name="notifications-outline" size={18} color={T.accent} />
      </Pressable>
    </>
  ) : undefined;

  return (
    <TopHeader
      onSettings={() => navigation.navigate("NotificationSettings")}
      onIncome={() => navigation.navigate("IncomeFlow")}
      onAnalytics={() => navigation.navigate("Analytics")}
      onNotifications={() => navigation.navigate("NotificationSettings")}
      onBack={handleBack}
      centerContent={incomeGridYearControl}
      centerLabel={monthLabel}
      leftVariant={shouldShowIncomeBack || isNotificationSettings ? "back" : "avatar"}
      showIncomeAction={!isIncomeGrid && !isNotificationSettings}
      rightContent={analyticsRightContent ?? incomeGridRightContent}
      compactActionsMenu={isNotificationSettings}
      onLogout={signOut}
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
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${T.cardAlt}66`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
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

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: T.bg } }}>
      {token ? (
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
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
