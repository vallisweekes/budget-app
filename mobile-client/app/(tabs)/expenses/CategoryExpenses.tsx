import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import CategoryExpensesScreen from "@/components/CategoryExpensesScreen";

export default function CategoryExpensesRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <CategoryExpensesScreen navigation={navigation as any} route={route as any} />;
}