import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import DashboardScreen from "@/components/DashboardScreen";

export default function DashboardRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <DashboardScreen navigation={navigation as any} route={route as any} />;
}