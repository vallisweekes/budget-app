import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { T } from "@/lib/theme";
import { useOnboardingGate } from "@/navigation/OnboardingGateContext";

export default function AppEntryRoute() {
  const { token, isLoading } = useAuth();
  const onboarding = useOnboardingGate();

  if (isLoading || onboarding.busy) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (onboarding.required) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}