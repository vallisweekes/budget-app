import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import UnplannedExpenseScreen from "@/components/UnplannedExpenseScreen";

export default function UnplannedExpenseRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <UnplannedExpenseScreen navigation={navigation as any} route={route as any} />;
}