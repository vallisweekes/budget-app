import type { useOnboardingScreenController } from "@/hooks";

export type OnboardingController = ReturnType<typeof useOnboardingScreenController>;

export type OnboardingStepContentProps = {
  controller: OnboardingController;
};