import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import SettingsStrategyScreen from "@/components/SettingsStrategyScreen";

export default function SettingsStrategyRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <SettingsStrategyScreen navigation={navigation as any} route={route as any} />;
}