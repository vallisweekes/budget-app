import React from "react";
import { Redirect } from "expo-router";

import OnboardingScreen from "@/components/OnboardingScreen";
import { useAuth } from "@/context/AuthContext";
import type { OnboardingStatusResponse } from "@/lib/apiTypes";
import { useOnboardingGate } from "@/navigation/OnboardingGateContext";

export default function OnboardingRoute() {
  const { pendingRegistration, token } = useAuth();
  const onboarding = useOnboardingGate();

  if (!token && !pendingRegistration) {
    return null;
  }

  const initial: OnboardingStatusResponse = token
    ? onboarding.state
    : {
      required: true,
      completed: false,
      profile: (pendingRegistration?.profile ?? null) as OnboardingStatusResponse["profile"],
      occupations: [],
    };

  return (
    <OnboardingScreen
      initial={initial}
      onCompleted={() => {
        if (token) {
          void onboarding.completeOnboardingAndHydrate();
        }
      }}
    />
  );
}