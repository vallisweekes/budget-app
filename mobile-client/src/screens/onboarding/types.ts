import type { OnboardingStatusResponse } from "@/lib/apiTypes";

export type VisibleGoal = "improve_savings" | "emergency_fund" | "investments";

export type OnboardingScreenProps = {
  initial: OnboardingStatusResponse;
  onCompleted: () => void;
};