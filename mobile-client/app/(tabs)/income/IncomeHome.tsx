import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import IncomeHomeScreen from "@/components/IncomeHomeScreen";

export default function IncomeHomeRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <IncomeHomeScreen navigation={navigation as any} route={route as any} />;
}