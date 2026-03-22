import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import ScanReceiptScreen from "@/components/ScanReceiptScreen";

export default function ScanReceiptRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return <ScanReceiptScreen navigation={navigation as any} route={route as any} />;
}