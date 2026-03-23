import React from "react";
import { Feather, Ionicons, Octicons } from "@expo/vector-icons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS } from "react-native";

import { T } from "@/lib/theme";

export default function MainTabsLayout() {
  const tabBarBackgroundColor = DynamicColorIOS({
    dark: "rgba(27, 31, 43, 0.9)",
    light: "rgba(255, 255, 255, 0.92)",
  });
  const tabBarShadowColor = DynamicColorIOS({
    dark: "rgba(8, 10, 18, 0.18)",
    light: "rgba(15, 40, 47, 0.12)",
  });
  const selectedTintColor = DynamicColorIOS({
    dark: T.onAccent,
    light: "#0f282f",
  });
  const inactiveIconColor = "#8E95A3";
  const inactiveLabelColor = "#8E95A3";
  const selectedTabLabelStyle = {
    color: selectedTintColor,
    fontSize: 11,
    fontWeight: "500" as const,
  };

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
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Feather} name="home" />}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="expenses">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="receipt-outline" />}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>Expenses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="debts">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="card-outline" />}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>Debts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="income">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="wallet-outline" />}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label selectedStyle={selectedTabLabelStyle}>Income</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
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
