import React from "react";
import { StackActions } from "@react-navigation/native";
import { Feather, Ionicons, Octicons } from "@expo/vector-icons";
import { useSegments } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { T } from "@/lib/theme";

type TabRouteState = {
  key: string;
  state?: {
    key?: string;
  };
};

function createResetOnBlurListeners() {
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
  const segments = useSegments() as string[];
  const tabBarBackgroundColor = T.card;
  const tabBarShadowColor = T.border;
  const selectedTintColor = T.onAccent;
  const inactiveIconColor = "#8E95A3";
  const inactiveLabelColor = "#8E95A3";
  const isDebtDetailRoute = segments[0] === "(tabs)" && segments[1] === "debts" && segments[2] === "DebtDetail";
  const selectedTabLabelStyle = {
    color: selectedTintColor,
    fontSize: 11,
    fontWeight: "500" as const,
  };
  const tabContentStyle = { backgroundColor: T.bg };
  const tabNativeProps = {
    nativeContainerBackgroundColor: T.bg,
  } as unknown as Record<string, unknown>;
  const resetOnBlurScreenProps = {
    listeners: createResetOnBlurListeners(),
  } as Record<string, unknown>;

  return (
    <NativeTabs
      backgroundColor={tabBarBackgroundColor}
      blurEffect="systemUltraThinMaterialDark"
      hidden={isDebtDetailRoute}
      shadowColor={tabBarShadowColor}
      tintColor={selectedTintColor}
      iconColor={inactiveIconColor}
      labelStyle={{
        color: inactiveLabelColor,
        fontSize: 11,
        fontWeight: "500",
      }}
      titlePositionAdjustment={{ vertical: 1 }}
      disableTransparentOnScrollEdge
      backBehavior="history"
    >
      <NativeTabs.Trigger
        {...resetOnBlurScreenProps}
        name="dashboard"
        contentStyle={tabContentStyle}
        unstable_nativeProps={tabNativeProps}
        disableTransparentOnScrollEdge
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
        disableTransparentOnScrollEdge
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
        disableTransparentOnScrollEdge
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
        disableTransparentOnScrollEdge
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
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Octicons} name="goal" />}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>Goals</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
