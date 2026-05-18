import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Stack } from "expo-router";

import SettingsProfileDetailsScreen from "@/components/SettingsProfileDetailsScreen";
import TabRouteHeader from "@/navigation/TabRouteHeader";

export default function SettingsProfileDetailsRoute() {
  const navigation = useNavigation();
  const route = useRoute();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
          headerShadowVisible: false,
          header: () => <TabRouteHeader />,
        }}
      />
      <SettingsProfileDetailsScreen navigation={navigation as any} route={route as any} />
    </>
  );
}