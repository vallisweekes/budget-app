import React from "react";

import AnalyticsScreen from "@/components/AnalyticsScreen";
import { DeferredTabRoute } from "@/components/Shared/DeferredTabRoute";

export default function AnalyticsYearTabRoute() {
  return (
    <DeferredTabRoute>
      <AnalyticsScreen overviewMode="year" />
    </DeferredTabRoute>
  );
}
