import React, { type ComponentType } from "react";

import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useOnboardingGate } from "@/navigation/OnboardingGateContext";
import { T } from "@/lib/theme";

type Options = {
  allowDuringOnboarding?: boolean;
};

export function withProtectedScreen<Props extends object>(ScreenComponent: ComponentType<Props>, options?: Options) {
  return function ProtectedRoute(props: Props) {
    const { token, isLoading } = useAuth();
    const onboarding = useOnboardingGate();

    if (isLoading || onboarding.busy) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
          <ActivityIndicator size="large" color={T.accent} />
          {onboarding.busy ? <Text style={{ marginTop: 10, color: T.textDim, fontSize: 14, fontWeight: "600" }}>Loading…</Text> : null}
        </View>
      );
    }

    if (!token) {
      return <Redirect href="/Login" />;
    }

    if (onboarding.required && !options?.allowDuringOnboarding) {
      return <Redirect href="/Onboarding" />;
    }

    return React.createElement(ScreenComponent, props);
  };
}