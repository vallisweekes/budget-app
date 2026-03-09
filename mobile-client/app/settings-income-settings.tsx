import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import SettingsIncomeSettingsScreen from "@/components/SettingsIncomeSettingsScreen";

export default function SettingsIncomeSettingsRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <SettingsIncomeSettingsScreen navigation={navigation as any} route={route as any} />;
}