import { Redirect, useLocalSearchParams } from "expo-router";

import { DeferredTabRoute } from "@/components/Shared/DeferredTabRoute";

export default function ExpensesRoute() {
  const params = useLocalSearchParams();

  return (
    <DeferredTabRoute>
      <Redirect href={{ pathname: "/(tabs)/expenses/ExpensesList", params }} />
    </DeferredTabRoute>
  );
}