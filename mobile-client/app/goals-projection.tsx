import React from "react";
import { useNavigation } from "@react-navigation/native";

import GoalsProjectionScreen from "@/components/GoalsProjectionScreen";

export default function GoalsProjectionRoute() {
  const navigation = useNavigation();

  return <GoalsProjectionScreen navigation={navigation as any} />;
}