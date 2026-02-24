import React from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import type { RootStackParamList, MainTabParamList, IncomeStackParamList, ExpensesStackParamList, DebtStackParamList } from "@/navigation/types";
import TopHeader from "@/components/Shared/TopHeader";
import PillTabBar from "@/components/Shared/PillTabBar";
import { T } from "@/lib/theme";

import LoginScreen from "@/screens/LoginScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import IncomeScreen from "@/screens/IncomeScreen";
import IncomeMonthScreen from "@/screens/IncomeMonthScreen";
import ExpensesScreen from "@/screens/ExpensesScreen";
import CategoryExpensesScreen from "@/screens/CategoryExpensesScreen";
import DebtScreen from "@/screens/DebtScreen";
import DebtDetailScreen from "@/screens/DebtDetailScreen";
import DebtAnalyticsScreen from "@/screens/DebtAnalyticsScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import PaymentsScreen from "@/screens/PaymentsScreen";
import GoalsScreen from "@/screens/GoalsScreen";
import GoalsProjectionScreen from "@/screens/GoalsProjectionScreen";

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

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        header: () => (
          <TopHeader onSettings={() => navigation.navigate("Settings")} />
        ),
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
        name="Income"
        component={IncomeStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
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
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen name="Goals" component={GoalsScreen} />
          <Stack.Screen name="GoalsProjection" component={GoalsProjectionScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
