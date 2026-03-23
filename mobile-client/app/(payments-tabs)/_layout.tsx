import React from "react";
import { Feather } from "@expo/vector-icons";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { T } from "@/lib/theme";

export default function PaymentsTabsLayout() {
  const selectedTintColor = T.onAccent;
  const inactiveIconColor = "#8E95A3";
  const inactiveLabelColor = "#8E95A3";
  const tabContentStyle = { backgroundColor: T.bg };
  const tabNativeProps = {
    nativeContainerBackgroundColor: T.bg,
  } as unknown as Record<string, unknown>;

  return (
    <NativeTabs
      sidebarAdaptable
      backgroundColor={T.card}
      blurEffect="systemUltraThinMaterialDark"
      shadowColor={T.border}
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
        name="home"
        contentStyle={tabContentStyle}
        unstable_nativeProps={tabNativeProps}
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Feather} name="home" />}
          renderingMode="template"
          selectedColor={selectedTintColor}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="search"
        role="search"
        contentStyle={tabContentStyle}
        unstable_nativeProps={tabNativeProps}
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
