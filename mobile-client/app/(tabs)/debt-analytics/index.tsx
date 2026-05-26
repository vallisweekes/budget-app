import React from "react";

import DebtAnalyticsScreen from "@/components/DebtAnalyticsScreen";
import { DeferredTabRoute } from "@/components/Shared/DeferredTabRoute";

export default function DebtAnalyticsTabRoute() {
  return (
    <DeferredTabRoute>
      <DebtAnalyticsScreen />
    </DeferredTabRoute>
  );
}