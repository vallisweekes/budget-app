import React from "react";
import { Stack } from "expo-router";

import { T } from "@/lib/theme";
import TabRouteHeader from "@/navigation/TabRouteHeader";

export default function GoalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        headerStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        header: () => <TabRouteHeader />,
        animation: "none",
        contentStyle: { backgroundColor: T.bg },
      }}
    />
  );
}