import React from "react";
import { Ionicons, Octicons } from "@expo/vector-icons";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { T } from "@/lib/theme";

export default function MainTabsLayout() {
  return (
    <NativeTabs
      backgroundColor={T.bg}
      tintColor={T.accent}
      iconColor={{ default: T.textDim, selected: T.accent }}
      labelStyle={{ color: T.textDim, fontSize: 12, fontWeight: "700" }}
      disableTransparentOnScrollEdge
      backBehavior="history"
    >
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="home-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="home" />,
          }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="expenses">
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="receipt-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="receipt" />,
          }}
        />
        <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="debts">
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="card-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="card" />,
          }}
        />
        <NativeTabs.Trigger.Label>Debts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="income">
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="wallet-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="wallet" />,
          }}
        />
        <NativeTabs.Trigger.Label>Income</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Octicons} name="goal" />}
        />
        <NativeTabs.Trigger.Label>Goals</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}