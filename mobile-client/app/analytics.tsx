import React from "react";
import { Stack } from "expo-router";

import AnalyticsScreen from "@/components/AnalyticsScreen";
import TabRouteHeader from "@/navigation/TabRouteHeader";

export default function AnalyticsRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
          headerShadowVisible: false,
          header: () => <TabRouteHeader />,
        }}
      />
      <AnalyticsScreen />
    </>
  );
}