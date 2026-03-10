import React from "react";

import OnboardingScreen from "@/components/OnboardingScreen";
import { useOnboardingGate } from "@/navigation/OnboardingGateContext";

export default function OnboardingRoute() {
  const onboarding = useOnboardingGate();

  return (
    <OnboardingScreen
      initial={onboarding.state}
      onCompleted={() => {
        void onboarding.completeOnboardingAndHydrate();
      }}
    />
  );
}