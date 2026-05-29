import React from "react";

import AnalyticsScreen from "@/components/AnalyticsScreen";
import { DeferredTabRoute } from "@/components/Shared/DeferredTabRoute";

export default function AnalyticsMonthTabRoute() {
  return (
    <DeferredTabRoute>
      <AnalyticsScreen overviewMode="month" />
    </DeferredTabRoute>
  );
}
