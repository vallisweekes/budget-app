import React from "react";
import { Stack } from "expo-router";

import { T } from "@/lib/theme";
import TabRouteHeader from "@/navigation/TabRouteHeader";

export default function IncomeLayout() {
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
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}