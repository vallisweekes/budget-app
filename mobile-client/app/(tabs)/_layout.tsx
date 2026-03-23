import React from "react";
import { Feather, Ionicons, Octicons } from "@expo/vector-icons";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { T } from "@/lib/theme";

export default function MainTabsLayout() {
  const tabBarBackgroundColor = T.card;
  const tabBarShadowColor = T.border;
  const selectedTintColor = T.onAccent;
  const inactiveIconColor = "#8E95A3";
  const inactiveLabelColor = "#8E95A3";
  const selectedTabLabelStyle = {
    color: selectedTintColor,
    fontSize: 11,
    fontWeight: "500" as const,
  };
  const tabContentStyle = { backgroundColor: T.bg };
  const tabNativeProps = {
    nativeContainerBackgroundColor: T.bg,
  } as unknown as Record<string, unknown>;

  return (
    <NativeTabs
      backgroundColor={tabBarBackgroundColor}
      blurEffect="systemUltraThinMaterialDark"
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
