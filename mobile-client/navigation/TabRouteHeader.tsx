import React from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";

import TopHeader from "@/components/Shared/TopHeader";
import { useActiveBudgetPlan } from "@/context/ActiveBudgetPlanContext";
import { useAuth } from "@/context/AuthContext";
import { markSkipExpensesFocusReload } from "@/lib/helpers/expensesFocusReload";
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

export default function TabRouteHeader() {
  const router = useRouter();
  const navigation = useNavigation<any>();
  const segments = useSegments() as string[];
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const { signOut } = useAuth();
  const { activeBudgetPlanId, bootstrapBudgetPlanId } = useActiveBudgetPlan();

  const rootSegment = typeof segments[0] === "string" ? segments[0] : "";
  const tabSegment = rootSegment === "(tabs)" && typeof segments[1] === "string" ? segments[1] : "";
  const leafSegment = rootSegment === "(tabs)" && typeof segments[2] === "string" ? segments[2] : "";

  const isAnalytics = rootSegment === "analytics";
  const isSettings = rootSegment === "settings";
  const isGoals = tabSegment === "goals";
  const isIncomeTab = tabSegment === "income";
  const isCategoryExpenses = leafSegment === "CategoryExpenses";
  const isDebtDetail = leafSegment === "DebtDetail";
  const isExpenseDetail = leafSegment === "ExpenseDetail";
  const isLoggedExpenses = leafSegment === "LoggedExpenses";
  const isExpensesList = leafSegment === "ExpensesList";
  const isUnplannedExpense = leafSegment === "UnplannedExpense";
  const isScanReceipt = leafSegment === "ScanReceipt";
  const isDebtAnalytics = leafSegment === "DebtAnalytics";
  const isIncomeMonth = leafSegment === "IncomeMonth";

  if (isDebtDetail || isExpenseDetail) {
    return null;
  }

  const monthNum = getNumberParam(params.month);
  const yearNum = getNumberParam(params.year);
  const incomeMonthBudgetPlanId = getStringParam(params.budgetPlanId) ?? "";
  const incomeMonthInitialMode = getStringParam(params.initialMode) === "sacrifice" ? "sacrifice" : "income";
  const canUseIncomeMonthSwitcher = isIncomeTab
    && isIncomeMonth
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
  const resolvedCurrentPeriodMonth = Number.isFinite(currentPeriodMonth) && currentPeriodMonth >= 1 && currentPeriodMonth <= 12
    ? Math.floor(currentPeriodMonth)
    : new Date().getMonth() + 1;
  const resolvedCurrentPeriodYear = Number.isFinite(currentPeriodYear)
    ? Math.floor(currentPeriodYear)
    : new Date().getFullYear();
  const resolvedSelectedPeriodMonth = Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12
    ? Math.floor(monthNum)
    : resolvedCurrentPeriodMonth;
  const resolvedSelectedPeriodYear = Number.isFinite(yearNum)
    ? Math.floor(yearNum)
    : resolvedCurrentPeriodYear;
  const isPastExpensesPeriod = isExpensesList
    && (
      resolvedSelectedPeriodYear < resolvedCurrentPeriodYear
      || (resolvedSelectedPeriodYear === resolvedCurrentPeriodYear && resolvedSelectedPeriodMonth < resolvedCurrentPeriodMonth)
    );

  const categoryExpensesName = getStringParam(params.categoryName);
  const categoryExpensesMonth = getNumberParam(params.month);
  const categoryExpensesYear = getNumberParam(params.year);
  const hasCategoryMonthYear = Number.isFinite(categoryExpensesMonth)
    && categoryExpensesMonth >= 1
    && categoryExpensesMonth <= 12
    && Number.isFinite(categoryExpensesYear);

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
        pushRoute("/(tabs)/income/IncomeMonth", {
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
    if (isLoggedExpenses) {
      const categoryId = getStringParam(params.categoryId);

      if (categoryId) {
        replaceRoute("/(tabs)/expenses/CategoryExpenses", {
          categoryId,
          categoryName: getStringParam(params.categoryName),
          color: getStringParam(params.color),
          icon: getStringParam(params.icon),
          month: Number.isFinite(monthNum) ? Math.floor(monthNum) : undefined,
          year: Number.isFinite(yearNum) ? Math.floor(yearNum) : undefined,
          budgetPlanId: getStringParam(params.budgetPlanId),
          currency: getStringParam(params.currency) ?? "£",
          skipFocusReloadAt: Date.now(),
        });
        return;
      }

      replaceRoute("/(tabs)/expenses/ExpensesList", {
        month: Number.isFinite(monthNum) ? Math.floor(monthNum) : undefined,
        year: Number.isFinite(yearNum) ? Math.floor(yearNum) : undefined,
        budgetPlanId: getStringParam(params.budgetPlanId),
        currency: getStringParam(params.currency) ?? "£",
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
      const currentSubTab = getStringParam(params.subTab) ?? "details";
      if (currentSubTab !== "details") {
        replaceRoute("/settings", { subTab: "details" });
        return;
      }
      replaceRoute("/(tabs)/dashboard");
      return;
    }

    if (navigation.canGoBack?.()) {
      navigation.goBack();
    }
  };

  const goalsRightContent = isGoals ? (
    <Pressable
      onPress={() => router.setParams({ openAddToken: String(Date.now()) })}
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
      <Pressable onPress={() => router.setParams({ overviewMode: "month" })} style={{ flex: 1, alignItems: "center", justifyContent: "center" }} hitSlop={10}>
        <Text style={{ color: analyticsOverviewMode === "month" ? T.onAccent : T.textDim, fontSize: 12, fontWeight: "800" }}>M</Text>
      </Pressable>
      <Pressable onPress={() => router.setParams({ overviewMode: "year" })} style={{ flex: 1, alignItems: "center", justifyContent: "center" }} hitSlop={10}>
        <Text style={{ color: analyticsOverviewMode === "year" ? T.onAccent : T.textDim, fontSize: 12, fontWeight: "800" }}>Y</Text>
      </Pressable>
    </View>
  ) : undefined;

  const expensesListLeftContent = isExpensesList && isPersonalPlan && !isPastExpensesPeriod ? (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Pressable
        onPress={() => {
          pushRoute("/(tabs)/expenses/UnplannedExpense", {
            month: resolvedCurrentPeriodMonth,
            year: resolvedCurrentPeriodYear,
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
          month: resolvedCurrentPeriodMonth,
          year: resolvedCurrentPeriodYear,
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
          month: Number.isFinite(monthNum) ? Math.floor(monthNum) : resolvedCurrentPeriodMonth,
          year: Number.isFinite(yearNum) ? Math.floor(yearNum) : resolvedCurrentPeriodYear,
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

  return (
    <TopHeader
      onSettings={() => pushRoute("/settings")}
      onIncome={() => {}}
      onAnalytics={() => pushRoute("/analytics")}
      onNotifications={() => pushRoute("/settings", { initialTab: "notifications" })}
      leftContent={expensesListLeftContent}
      leftVariant={isAnalytics || isSettings || isCategoryExpenses || isLoggedExpenses || isUnplannedExpense || isScanReceipt || isDebtAnalytics ? "back" : "avatar"}
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