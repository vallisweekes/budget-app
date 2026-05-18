import React from "react";
import { StackActions } from "@react-navigation/native";
import { Feather, Ionicons, Octicons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { T } from "@/lib/theme";

type TabRouteState = {
  key: string;
  state?: {
    key?: string;
  };
};

function createTabListeners(options?: { onTabPress?: () => void; preventDefaultOnTabPress?: boolean }) {
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
  });
}

export default function MainTabsLayout() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const incomeAddTokenRef = React.useRef(0);
  const selectedTintColor = T.onAccent;
  const inactiveIconColor = "#8E95A3";
  const inactiveLabelColor = "#8E95A3";
  const isDebtDetailRoute = segments[0] === "(tabs)" && segments[1] === "debts" && segments[2] === "DebtDetail";
  const isExpenseDetailRoute = segments[0] === "(tabs)" && segments[1] === "expenses" && segments[2] === "ExpenseDetail";
  const isGoalDetailRoute = segments[0] === "(tabs)" && segments[1] === "goals" && segments[2] === "GoalDetail";
  const isCategoryExpensesSplitRoute = segments[0] === "(tabs)"
    && segments[1] === "expenses"
    && segments[2] === "CategoryExpenses";
  const isIncomeSplitRoute = segments[0] === "(tabs)"
    && segments[1] === "income"
    && (segments[2] === "IncomeMonth" || segments[2] === "IncomeGrid");
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
  const resetOnBlurScreenProps = {
    listeners: createTabListeners(),
  } as Record<string, unknown>;
  const incomeTriggerScreenProps = {
    listeners: createTabListeners(isIncomeSplitRoute
      ? {
          onTabPress: () => {
            incomeAddTokenRef.current += 1;
            const nextToken = String(incomeAddTokenRef.current);

            if (segments[2] === "IncomeMonth") {
              router.setParams({ openIncomeAddAt: nextToken });
              return;
            }

            if (segments[2] === "IncomeGrid") {
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
            router.replace("/(tabs)/expenses");
          },
          preventDefaultOnTabPress: true,
        }
      : undefined),
  } as Record<string, unknown>;

  if (isCategoryExpensesSplitRoute) {
    return (
      <NativeTabs
        hidden={isDebtDetailRoute || isGoalDetailRoute}
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
        hidden={isDebtDetailRoute || isGoalDetailRoute}
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
          <NativeTabs.Trigger.Label selectedStyle={splitRouteSelectedTabLabelStyle}>Home</NativeTabs.Trigger.Label>
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
          <NativeTabs.Trigger.Label selectedStyle={splitRouteSelectedTabLabelStyle}>Expenses</NativeTabs.Trigger.Label>
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

  return (
    <>
      <NativeTabs
        backgroundColor={tabBarBackgroundColor}
        blurEffect={tabBarBlurEffect}
        hidden={isDebtDetailRoute || isExpenseDetailRoute || isGoalDetailRoute}
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
          <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>Home</NativeTabs.Trigger.Label>
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
          <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>Expenses</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
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
          <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>Debts</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
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
          <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>Income</NativeTabs.Trigger.Label>
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
          <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>Goals</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
