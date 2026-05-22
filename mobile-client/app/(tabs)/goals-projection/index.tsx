import React from "react";
import { useNavigation } from "@react-navigation/native";

import GoalsProjectionScreen from "@/components/GoalsProjectionScreen";

export default function GoalsProjectionTabRoute() {
  const navigation = useNavigation();

  return <GoalsProjectionScreen navigation={navigation as any} />;
}