import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import ExpenseDetailScreen from "@/components/ExpenseDetailScreen";

export default function ExpenseDetailRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <ExpenseDetailScreen navigation={navigation as any} route={route as any} />;
}