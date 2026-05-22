import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import { DeferredTabRoute } from "@/components/Shared/DeferredTabRoute";
import GoalsScreen from "@/components/GoalsScreen";

export default function GoalsRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return (
    <DeferredTabRoute>
      <GoalsScreen navigation={navigation as any} route={route as any} />
    </DeferredTabRoute>
  );
}