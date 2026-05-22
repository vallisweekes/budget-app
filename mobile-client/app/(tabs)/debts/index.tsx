import { Redirect } from "expo-router";

import { DeferredTabRoute } from "@/components/Shared/DeferredTabRoute";

export default function DebtsRoute() {
  return (
    <DeferredTabRoute>
      <Redirect href="/(tabs)/debts/DebtList" />
    </DeferredTabRoute>
  );
}