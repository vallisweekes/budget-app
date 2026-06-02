import React from "react";
import { Stack, useLocalSearchParams } from "expo-router";

import AnalyticsDebtDistributionScreen from "@/components/AnalyticsDebtDistributionScreen";
import TabRouteHeader from "@/navigation/TabRouteHeader";
import type { AnalyticsOverviewMode } from "@/types";

export default function AnalyticsDebtDistributionRoute() {
  const params = useLocalSearchParams<{ overviewMode?: string }>();
  const overviewMode: AnalyticsOverviewMode = params.overviewMode === "month" ? "month" : "year";

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
      <AnalyticsDebtDistributionScreen overviewMode={overviewMode} />
    </>
  );
}
