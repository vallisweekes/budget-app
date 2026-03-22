import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import LoggedExpensesScreen from "@/components/LoggedExpensesScreen";

export default function LoggedExpensesRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <LoggedExpensesScreen navigation={navigation as any} route={route as any} />;
}