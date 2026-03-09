import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import SettingsProfileDetailsScreen from "@/components/SettingsProfileDetailsScreen";

export default function SettingsProfileDetailsRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <SettingsProfileDetailsScreen navigation={navigation as any} route={route as any} />;
}