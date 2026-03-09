import type { useOnboardingScreenController } from "@/lib/hooks/useOnboardingScreenController";

export type OnboardingController = ReturnType<typeof useOnboardingScreenController>;

export type OnboardingStepContentProps = {
  controller: OnboardingController;
};