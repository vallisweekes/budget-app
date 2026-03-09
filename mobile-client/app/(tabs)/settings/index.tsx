import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import SettingsScreen from "@/components/SettingsScreen";

export default function SettingsRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <SettingsScreen navigation={navigation as any} route={route as any} />;
}