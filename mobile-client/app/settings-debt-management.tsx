import React from "react";
import { Stack } from "expo-router";

import SettingsDebtManagementScreen from "@/components/SettingsDebtManagementScreen";
import TabRouteHeader from "@/navigation/TabRouteHeader";

export default function SettingsDebtManagementRoute() {
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
      <SettingsDebtManagementScreen />
    </>
  );
}