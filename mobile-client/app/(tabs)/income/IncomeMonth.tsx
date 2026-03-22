import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import IncomeMonthScreen from "@/components/IncomeMonthScreen";

export default function IncomeMonthRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <IncomeMonthScreen navigation={navigation as any} route={route as any} />;
}