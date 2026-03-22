import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Stack } from "expo-router";

import SettingsScreen from "@/components/SettingsScreen";
import TabRouteHeader from "@/navigation/TabRouteHeader";

export default function SettingsRoute() {
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
      <SettingsScreen navigation={navigation as any} route={route as any} />
    </>
  );
}