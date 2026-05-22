import { Redirect } from "expo-router";

import { DeferredTabRoute } from "@/components/Shared/DeferredTabRoute";

export default function IncomeRoute() {
  return (
    <DeferredTabRoute>
      <Redirect href="/(tabs)/income/IncomeHome" />
    </DeferredTabRoute>
  );
}