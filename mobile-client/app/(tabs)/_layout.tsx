import React from "react";
import { StackActions, useNavigation } from "@react-navigation/native";
import { Feather, Ionicons, Octicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAuth } from "@/context/AuthContext";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { useAppTranslation } from "@/hooks";
import { emitIncomeAddTrigger } from "@/lib/events/incomeAddTrigger";
import { getSharedExpensePeriodRouteState, resolveExpensePeriodRouteState } from "@/lib/helpers/expensePeriodRouteState";
import { isDebtManagementEnabled, hasPositiveDebtBalance } from "@/lib/helpers/debtManagement";
import { T } from "@/lib/theme";
import { emitCategoryAddExpenseTrigger } from "@/lib/events/categoryAddExpenseTrigger";
import { useGetDebtSummaryQuery } from "@/store/api";

type TabRouteState = {
  key: string;
  state?: {
    key?: string;
  };
};

function createTabListeners(options?: { onTabPress?: () => void; preventDefaultOnTabPress?: boolean; resetOnBlur?: boolean }) {
  return ({
    route,
    navigation,
  }: {
    route: { key: string };
    navigation: {
      getState(): { routes: TabRouteState[] };
      dispatch(action: unknown): void;
    };
  }) => ({
    ...(options?.onTabPress ? {
      tabPress: (event: { preventDefault?: () => void }) => {
        if (options.preventDefaultOnTabPress) {
          event.preventDefault?.();
        }
        options.onTabPress?.();
      },
    } : null),
    ...(options?.resetOnBlur === false
      ? null
      : {
          blur: () => {
            const tabRoute = navigation.getState().routes.find(
              (candidate) => candidate.key === route.key
            );
            const nestedNavigatorKey = tabRoute?.state?.key;

            if (!nestedNavigatorKey) {
              return;
            }

            navigation.dispatch({
              ...StackActions.popToTop(),
              target: nestedNavigatorKey,
            });
          },
        }),
  });
}

function getParamString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

export default function MainTabsLayout() {
  const router = useRouter();
  const navigation = useNavigation<any>();
  const segments = useSegments() as string[];
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const { profile } = useAuth();
  const { dashboard, isLoading: bootstrapLoading } = useBootstrapData();
  const { t } = useAppTranslation();
  const debtSummaryQuery = useGetDebtSummaryQuery(undefined, {
    skip: !profile || bootstrapLoading || (Boolean(dashboard) && typeof dashboard?.activeDebtCount === "number"),
  });
  const incomeAddTokenRef = React.useRef(0);
  const debtAddTokenRef = React.useRef(0);
  const categoryAddTokenRef = React.useRef(0);
  const expenseAddTokenRef = React.useRef(0);
  const selectedTintColor = T.onAccent;
  const inactiveIconColor = "#8E95A3";
  const inactiveLabelColor = "#8E95A3";
  const isDebtDetailRoute = segments[0] === "(tabs)" && segments[1] === "debts" && segments[2] === "DebtDetail";
  const isExpenseDetailRoute = segments[0] === "(tabs)" && segments[1] === "expenses" && segments[2] === "ExpenseDetail";
  const isExpensesListRoute = segments[0] === "(tabs)" && segments[1] === "expenses" && segments[2] === "ExpensesList";
  const isUnplannedExpenseRoute = segments[0] === "(tabs)" && segments[1] === "expenses" && segments[2] === "UnplannedExpense";
  const isLoggedExpensesRoute = segments[0] === "(tabs)" && segments[1] === "logged-expenses";
  const isLoggedExpensesNestedRoute = segments[0] === "(tabs)" && segments[1] === "expenses" && segments[2] === "LoggedExpenses";
  const isLoggedSearchRoute = segments[0] === "(tabs)" && segments[1] === "search";
  const isExpensesSplitRoute = isExpensesListRoute;
  const isGoalDetailRoute = segments[0] === "(tabs)" && segments[1] === "goals" && segments[2] === "GoalDetail";
  const isGoalsRootRoute = segments[0] === "(tabs)" && segments[1] === "goals" && typeof segments[2] !== "string";
  const isGoalsProjectionRoute = segments[0] === "(tabs)" && segments[1] === "goals-projection";
  const isGoalsSplitRoute = isGoalsRootRoute || isGoalsProjectionRoute;
  const isDebtAnalyticsNestedRoute = segments[0] === "(tabs)" && segments[1] === "debts" && segments[2] === "DebtAnalytics";
  const isDebtAnalyticsTabRoute = segments[0] === "(tabs)" && segments[1] === "debt-analytics";
  const isCategoryExpensesSplitRoute = segments[0] === "(tabs)"
    && segments[1] === "expenses"
    && segments[2] === "CategoryExpenses";
  const isIncomeSplitRoute = segments[0] === "(tabs)"
    && segments[1] === "income"
    && (segments[2] === "IncomeMonth" || segments[2] === "IncomeGrid");
  const getDeepestRoute = (state: any): any => {
    if (!state?.routes?.length) return null;
    const route = state.routes[state.index ?? state.routes.length - 1];
    if (route?.state) return getDeepestRoute(route.state);
    return route;
  };
  const deepestRoute = getDeepestRoute(navigation.getState?.());
  const routeParams = (deepestRoute?.params ?? {}) as Record<string, unknown>;
  const routeInitialMode = typeof routeParams.initialMode === "string" ? routeParams.initialMode : undefined;
  const isAnyDebtRoute = (segments[0] === "(tabs)" && segments[1] === "debts") || isDebtAnalyticsTabRoute;
  const isDebtSplitRoute = isDebtAnalyticsTabRoute || (
    segments[0] === "(tabs)"
    && segments[1] === "debts"
    && !isDebtDetailRoute
    && !isDebtAnalyticsNestedRoute
  );
  const incomeInitialMode = routeInitialMode ?? getParamString(params.initialMode);
  const isIncomeSacrificeMode = isIncomeSplitRoute && incomeInitialMode === "sacrifice";
  const hasActualDebts = React.useMemo(() => {
    if (typeof dashboard?.activeDebtCount === "number") {
      return dashboard.activeDebtCount > 0;
    }

    if (debtSummaryQuery.isSuccess) {
      return (debtSummaryQuery.data?.activeCount ?? 0) > 0;
    }

    return hasPositiveDebtBalance(dashboard?.debts);
  }, [dashboard?.activeDebtCount, dashboard?.debts, debtSummaryQuery.data?.activeCount, debtSummaryQuery.isSuccess]);
  const showDebtsTab = isDebtManagementEnabled({
    hasActualDebts,
    profileHasDebtsToManage: profile?.onboarding?.profile?.hasDebtsToManage,
  });
  const debtVisibilityResolved = !bootstrapLoading && (
    !profile
    || debtSummaryQuery.isSuccess
    || debtSummaryQuery.isError
    || Boolean(dashboard)
    || profile?.onboarding?.profile?.hasDebtsToManage === true
  );
  const isTabsHidden = isDebtDetailRoute
    || isExpenseDetailRoute
    || isUnplannedExpenseRoute
    || isGoalDetailRoute
    || isGoalsProjectionRoute
    || isDebtAnalyticsTabRoute
    || isIncomeSacrificeMode;
  const shouldHideNativeTabs = isTabsHidden || segments[0] !== "(tabs)";
  const tabsLayoutKey = (isLoggedExpensesNestedRoute || isLoggedSearchRoute)
    ? "tabs:expenses-split:logged"
    : isExpensesSplitRoute
    ? "tabs:expenses-split:root"
    : isCategoryExpensesSplitRoute
    ? "tabs:category-expenses-split"
    : isIncomeSplitRoute
      ? `tabs:income-split:${isIncomeSacrificeMode ? "sacrifice" : "income"}`
      : isGoalsSplitRoute
        ? "tabs:goals-split"
      : isDebtSplitRoute
        ? "tabs:debt-split"
        : `tabs:main:${showDebtsTab ? "with-debts" : "without-debts"}:${shouldHideNativeTabs ? "hidden" : "visible"}`;
  const tabBarBackgroundColor = (isIncomeSplitRoute || isCategoryExpensesSplitRoute) ? undefined : T.card;
  const tabBarBlurEffect = (isIncomeSplitRoute || isCategoryExpensesSplitRoute) ? undefined : "systemUltraThinMaterialDark";
  const tabBarShadowColor = (isIncomeSplitRoute || isCategoryExpensesSplitRoute) ? undefined : T.border;
  const splitRouteLabelStyle = {
    color: inactiveLabelColor,
    fontSize: 10,
    fontWeight: "500" as const,
  };
  const selectedTabLabelStyle = {
    color: selectedTintColor,
    fontSize: 11,
    fontWeight: "500" as const,
  };
  const splitRouteSelectedTabLabelStyle = {
    color: selectedTintColor,
    fontSize: 10,
    fontWeight: "500" as const,
  };
  const tabContentStyle = { backgroundColor: T.bg };
  const tabNativeProps = {
    nativeContainerBackgroundColor: T.bg,
  } as unknown as Record<string, unknown>;
  const localExpenseRouteState = resolveExpensePeriodRouteState({
    month: getParamString(params.month),
    year: getParamString(params.year),
    currentPeriodMonth: getParamString(params.currentPeriodMonth),
    currentPeriodYear: getParamString(params.currentPeriodYear),
    budgetPlanId: getParamString(params.budgetPlanId),
    currency: getParamString(params.currency),
  });
  const sharedExpenseRouteState = getSharedExpensePeriodRouteState();
  const preferredExpenseDisplayedAnchor = sharedExpenseRouteState.displayedAnchor ?? localExpenseRouteState.displayedAnchor;
  const preferredExpenseCurrentAnchor = sharedExpenseRouteState.currentAnchor ?? localExpenseRouteState.currentAnchor;
  const splitMonth = preferredExpenseDisplayedAnchor?.month;
  const splitYear = preferredExpenseDisplayedAnchor?.year;
  const splitCurrentMonth = preferredExpenseCurrentAnchor?.month;
  const splitCurrentYear = preferredExpenseCurrentAnchor?.year;
  const splitBudgetPlanId = sharedExpenseRouteState.budgetPlanId ?? localExpenseRouteState.budgetPlanId;
  const splitCurrency = sharedExpenseRouteState.currency ?? localExpenseRouteState.currency;
  const resetOnBlurScreenProps = {
    listeners: createTabListeners(),
  } as Record<string, unknown>;
  const loggedExpensesSplitScreenProps = {
    listeners: createTabListeners(isExpensesListRoute
      ? {
          onTabPress: () => {
            router.push({
              pathname: "/(tabs)/expenses/LoggedExpenses",
              params: {
                categoryName: "All categories",
                month: splitMonth,
                year: splitYear,
                currentPeriodMonth: splitCurrentMonth,
                currentPeriodYear: splitCurrentYear,
                budgetPlanId: splitBudgetPlanId ?? undefined,
                currency: splitCurrency ?? undefined,
              },
            });
          },
          preventDefaultOnTabPress: true,
          resetOnBlur: false,
        }
      : undefined),
  } as Record<string, unknown>;
  const expensesSplitTriggerScreenProps = {
    listeners: createTabListeners(isExpensesListRoute || isLoggedExpensesNestedRoute || isLoggedExpensesRoute || isLoggedSearchRoute
      ? {
          onTabPress: () => {
            router.push({
              pathname: "/(tabs)/expenses/UnplannedExpense",
              params: {
                month: splitCurrentMonth ?? splitMonth,
                year: splitCurrentYear ?? splitYear,
              },
            });
          },
          preventDefaultOnTabPress: true,
          resetOnBlur: false,
        }
      : undefined),
  } as Record<string, unknown>;
  const expensesSplitAddTriggerScreenProps = {
    listeners: createTabListeners(isExpensesSplitRoute
      ? {
          onTabPress: () => {
            expenseAddTokenRef.current += 1;
            router.setParams({ openAddExpenseAt: String(expenseAddTokenRef.current) });
          },
          preventDefaultOnTabPress: true,
          resetOnBlur: false,
        }
      : undefined),
  } as Record<string, unknown>;
  const incomeTriggerScreenProps = {
    listeners: createTabListeners(isIncomeSplitRoute
      ? {
          onTabPress: () => {
            if (segments[2] === "IncomeMonth") {
              incomeAddTokenRef.current = emitIncomeAddTrigger();
              return;
            }

            if (segments[2] === "IncomeGrid") {
              incomeAddTokenRef.current += 1;
              const nextToken = String(incomeAddTokenRef.current);
              router.setParams({ openYearIncomeSheetAt: nextToken });
            }
          },
          preventDefaultOnTabPress: true,
        }
      : undefined),
  } as Record<string, unknown>;

  const categorySplitTriggerScreenProps = {
    listeners: createTabListeners(isCategoryExpensesSplitRoute
      ? {
          onTabPress: () => {
            categoryAddTokenRef.current = emitCategoryAddExpenseTrigger();
          },
          preventDefaultOnTabPress: true,
          resetOnBlur: false,
        }
      : undefined),
  } as Record<string, unknown>;

  const debtSplitTriggerScreenProps = {
    listeners: createTabListeners(isDebtSplitRoute
      ? {
          onTabPress: () => {
            debtAddTokenRef.current += 1;
            const nextToken = String(debtAddTokenRef.current);

            if (isDebtAnalyticsTabRoute) {
              router.push({
                pathname: "/(tabs)/debts/DebtList",
                params: { openAddToken: nextToken },
              });
              return;
            }

            router.setParams({ openAddToken: nextToken });
          },
          preventDefaultOnTabPress: true,
          resetOnBlur: false,
        }
      : undefined),
  } as Record<string, unknown>;

  const goalsAddTokenRef = React.useRef(0);
  const goalsSplitTriggerScreenProps = {
    listeners: createTabListeners(isGoalsSplitRoute
      ? {
          onTabPress: () => {
            goalsAddTokenRef.current += 1;
            const nextToken = String(goalsAddTokenRef.current);

            if (isGoalsRootRoute) {
              router.setParams({ openAddToken: nextToken });
              return;
            }

            router.push({
              pathname: "/(tabs)/goals",
              params: { openAddToken: nextToken },
            });
          },
          preventDefaultOnTabPress: true,
          resetOnBlur: false,
        }
      : undefined),
  } as Record<string, unknown>;

  React.useEffect(() => {
    if (!debtVisibilityResolved || showDebtsTab || !isAnyDebtRoute) return;
    router.replace("/(tabs)/dashboard");
  }, [debtVisibilityResolved, isAnyDebtRoute, router, showDebtsTab]);

  if (isLoggedExpensesNestedRoute || isLoggedSearchRoute) {
    return (
      <NativeTabs
        key={tabsLayoutKey}
        hidden={shouldHideNativeTabs}
        tintColor={selectedTintColor}
        iconColor={inactiveIconColor}
        labelStyle={splitRouteLabelStyle}
        titlePositionAdjustment={{ vertical: -2 }}
        backBehavior="history"
      >
        <NativeTabs.Trigger
          {...expensesSplitTriggerScreenProps}
          name="expenses"
          disablePopToTop
          disableScrollToTop
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="add" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label hidden />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="search"
          role="search"
          disablePopToTop
          disableScrollToTop
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Label selectedStyle={splitRouteSelectedTabLabelStyle}>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  if (isExpensesSplitRoute) {
    return (
      <>
        <NativeTabs
          key={tabsLayoutKey}
          hidden={shouldHideNativeTabs}
          tintColor={selectedTintColor}
          iconColor={inactiveIconColor}
          labelStyle={splitRouteLabelStyle}
          titlePositionAdjustment={{ vertical: -2 }}
          backBehavior="history"
        >
          <NativeTabs.Trigger
            {...resetOnBlurScreenProps}
            name="dashboard"
            contentStyle={tabContentStyle}
            unstable_nativeProps={tabNativeProps}
          >
            <NativeTabs.Trigger.Icon
              src={<NativeTabs.Trigger.VectorIcon family={Feather} name="home" />}
              renderingMode="template"
              selectedColor={selectedTintColor}
            />
            <NativeTabs.Trigger.Label hidden />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            {...loggedExpensesSplitScreenProps}
            name="logged-expenses"
            contentStyle={tabContentStyle}
            unstable_nativeProps={tabNativeProps}
          >
            <NativeTabs.Trigger.Icon
              src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="list-outline" />}
              renderingMode="template"
              selectedColor={selectedTintColor}
            />
            <NativeTabs.Trigger.Label selectedStyle={splitRouteSelectedTabLabelStyle}>{t("tabs.logged")}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            {...expensesSplitAddTriggerScreenProps}
            name="expenses"
            role="search"
            disablePopToTop
            disableScrollToTop
            contentStyle={tabContentStyle}
            unstable_nativeProps={tabNativeProps}
          >
            <NativeTabs.Trigger.Icon
              src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="add" />}
              renderingMode="template"
              selectedColor={selectedTintColor}
            />
          </NativeTabs.Trigger>
        </NativeTabs>
      </>
    );
  }

  if (isCategoryExpensesSplitRoute) {
    return (
      <NativeTabs
        key={tabsLayoutKey}
        hidden={shouldHideNativeTabs}
        tintColor={selectedTintColor}
        iconColor={inactiveIconColor}
        labelStyle={splitRouteLabelStyle}
        titlePositionAdjustment={{ vertical: -2 }}
        backBehavior="history"
      >
        <NativeTabs.Trigger
          {...categorySplitTriggerScreenProps}
          name="expenses"
          role="search"
          disablePopToTop
          disableScrollToTop
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="add" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  if (isIncomeSplitRoute) {
    return (
      <NativeTabs
        key={tabsLayoutKey}
        hidden={shouldHideNativeTabs}
        tintColor={selectedTintColor}
        iconColor={inactiveIconColor}
        labelStyle={splitRouteLabelStyle}
        titlePositionAdjustment={{ vertical: -2 }}
        backBehavior="history"
      >
        <NativeTabs.Trigger
          {...resetOnBlurScreenProps}
          name="dashboard"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Feather} name="home" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label selectedStyle={splitRouteSelectedTabLabelStyle}>{t("tabs.home")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          {...resetOnBlurScreenProps}
          name="expenses"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="receipt-outline" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label selectedStyle={splitRouteSelectedTabLabelStyle}>{t("tabs.expenses")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          {...incomeTriggerScreenProps}
          name="income"
          role="search"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="add" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  if (isDebtSplitRoute) {
    return (
      <NativeTabs
        key={tabsLayoutKey}
        hidden={shouldHideNativeTabs}
        tintColor={selectedTintColor}
        iconColor={inactiveIconColor}
        labelStyle={splitRouteLabelStyle}
        titlePositionAdjustment={{ vertical: -2 }}
        backBehavior="history"
      >
        <NativeTabs.Trigger
          {...resetOnBlurScreenProps}
          name="dashboard"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Feather} name="home" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label selectedStyle={splitRouteSelectedTabLabelStyle}>{t("tabs.home")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          {...resetOnBlurScreenProps}
          name="debt-analytics"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="pie-chart-outline" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label hidden />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          {...debtSplitTriggerScreenProps}
          name="debts"
          role="search"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="add" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  if (isGoalsSplitRoute) {
    return (
      <NativeTabs
        key={tabsLayoutKey}
        hidden={shouldHideNativeTabs}
        tintColor={selectedTintColor}
        iconColor={inactiveIconColor}
        labelStyle={splitRouteLabelStyle}
        titlePositionAdjustment={{ vertical: -2 }}
        backBehavior="history"
      >
        <NativeTabs.Trigger
          {...resetOnBlurScreenProps}
          name="dashboard"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Feather} name="home" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label selectedStyle={splitRouteSelectedTabLabelStyle}>{t("tabs.home")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          {...resetOnBlurScreenProps}
          name="goals-projection"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="trending-up-outline" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label selectedStyle={splitRouteSelectedTabLabelStyle}>{t("tabs.projection")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          {...goalsSplitTriggerScreenProps}
          name="goals"
          role="search"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="add" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <>
      <NativeTabs
        key={tabsLayoutKey}
        backgroundColor={tabBarBackgroundColor}
        blurEffect={tabBarBlurEffect}
        hidden={shouldHideNativeTabs}
        shadowColor={tabBarShadowColor}
        tintColor={selectedTintColor}
        iconColor={inactiveIconColor}
        labelStyle={{
          color: inactiveLabelColor,
          fontSize: 11,
          fontWeight: "500",
        }}
        titlePositionAdjustment={{ vertical: -2 }}
        backBehavior="history"
      >
        <NativeTabs.Trigger
          {...resetOnBlurScreenProps}
          name="dashboard"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Feather} name="home" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>{t("tabs.home")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          {...resetOnBlurScreenProps}
          name="expenses"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="receipt-outline" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>{t("tabs.expenses")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        {showDebtsTab ? (
          <NativeTabs.Trigger
            {...resetOnBlurScreenProps}
            name="debts"
            contentStyle={tabContentStyle}
            unstable_nativeProps={tabNativeProps}
          >
            <NativeTabs.Trigger.Icon
              src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="card-outline" />}
              renderingMode="template"
              selectedColor={selectedTintColor}
            />
            <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>{t("tabs.debts")}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ) : null}
        <NativeTabs.Trigger
          {...resetOnBlurScreenProps}
          name="income"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="wallet-outline" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>{t("tabs.income")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          {...resetOnBlurScreenProps}
          name="goals"
          contentStyle={tabContentStyle}
          unstable_nativeProps={tabNativeProps}
        >
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Octicons} name="goal" />}
            renderingMode="template"
            selectedColor={selectedTintColor}
          />
          <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>{t("tabs.goals")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
