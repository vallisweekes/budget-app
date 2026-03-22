import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import ExpensesScreen from "@/components/ExpensesScreen";

export default function ExpensesListRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <ExpensesScreen navigation={navigation as any} route={route as any} />;
}