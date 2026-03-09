import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import PrivacyPolicyScreen from "@/components/PrivacyPolicyScreen";

export default function PrivacyPolicyRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <PrivacyPolicyScreen navigation={navigation as any} route={route as any} />;
}