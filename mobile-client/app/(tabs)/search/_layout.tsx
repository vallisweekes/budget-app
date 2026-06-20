import { Stack } from "expo-router";

import TabRouteHeader from "@/navigation/TabRouteHeader";
import { T } from "@/lib/theme";

export default function TabsSearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: T.bg },
        headerTintColor: T.text,
        headerShadowVisible: false,
        header: () => <TabRouteHeader />,
        animation: "default",
        contentStyle: { backgroundColor: T.bg },
      }}
    />
  );
}
