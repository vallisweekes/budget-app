import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import SettingsDebtManagementScreen from "@/components/SettingsDebtManagementScreen";

export default function SettingsDebtManagementRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <SettingsDebtManagementScreen navigation={navigation as any} route={route as any} />;
}