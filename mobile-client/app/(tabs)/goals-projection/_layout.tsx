import React from "react";
import { Stack } from "expo-router";

import { T } from "@/lib/theme";

export default function GoalsProjectionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
        contentStyle: { backgroundColor: T.bg },
      }}
    />
  );
}