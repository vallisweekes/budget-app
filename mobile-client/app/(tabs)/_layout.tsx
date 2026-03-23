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
  const inactiveIconColor = DynamicColorIOS({
    dark: "rgba(244, 246, 255, 0.68)",
    light: "rgba(15, 40, 47, 0.58)",
  });
  const inactiveLabelColor = DynamicColorIOS({
    dark: "rgba(244, 246, 255, 0.72)",
    light: "rgba(15, 40, 47, 0.72)",
  });

  return (
    <NativeTabs
      backgroundColor={tabBarBackgroundColor}
      blurEffect="systemUltraThinMaterialDark"
      shadowColor={tabBarShadowColor}
      tintColor={selectedTintColor}
      iconColor={{ default: inactiveIconColor, selected: selectedTintColor }}
      labelStyle={{
        default: { color: inactiveLabelColor, fontSize: 12, fontWeight: "500" },
        selected: { color: selectedTintColor, fontSize: 12, fontWeight: "600" },
      }}
      titlePositionAdjustment={{ vertical: 2 }}
      disableTransparentOnScrollEdge
      backBehavior="history"
    >
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Feather} name="home" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Feather} name="home" />,
          }}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="expenses">
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="receipt-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="receipt" />,
          }}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="debts">
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="card-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="card" />,
          }}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label>Debts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="income">
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="wallet-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="wallet" />,
          }}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label>Income</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Octicons} name="goal" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Octicons} name="goal" />,
          }}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label>Goals</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
