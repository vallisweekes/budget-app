import React from "react";
import { Ionicons, Octicons } from "@expo/vector-icons";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { T } from "@/lib/theme";

export default function MainTabsLayout() {
  return (
    <NativeTabs
      backgroundColor="rgba(22, 24, 38, 0.92)"
      blurEffect="systemChromeMaterialDark"
      shadowColor="rgba(0, 0, 0, 0.28)"
      tintColor={T.accent}
      iconColor={{ default: "#9399a6", selected: T.accent }}
      labelStyle={{
        default: { color: "#9399a6", fontSize: 12, fontWeight: "700" },
        selected: { color: T.accent, fontSize: 12, fontWeight: "700" },
      }}
      disableTransparentOnScrollEdge
      backBehavior="history"
    >
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="home-outline" />}
          renderingMode="template"
          selectedColor={T.accent}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="expenses">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="receipt-outline" />}
          renderingMode="template"
          selectedColor={T.accent}
        />
        <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="debts">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="card-outline" />}
          renderingMode="template"
          selectedColor={T.accent}
        />
        <NativeTabs.Trigger.Label>Debts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="income">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="wallet-outline" />}
          renderingMode="template"
          selectedColor={T.accent}
        />
        <NativeTabs.Trigger.Label>Income</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Octicons} name="goal" />}
          renderingMode="template"
          selectedColor={T.accent}
        />
        <NativeTabs.Trigger.Label>Goals</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
