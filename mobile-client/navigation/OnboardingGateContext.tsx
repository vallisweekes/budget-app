import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { OnboardingStatusResponse, UserProfile } from "@/lib/apiTypes";

const ONBOARDING_FALLBACK: OnboardingStatusResponse = {
  required: false,
  completed: false,
  profile: null,
  occupations: [],
};

type OnboardingGateContextValue = {
  busy: boolean;
  required: boolean;
  state: OnboardingStatusResponse;
  completeOnboardingAndHydrate: () => Promise<void>;
};

const OnboardingGateContext = createContext<OnboardingGateContextValue | null>(null);

export function OnboardingGateProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading, profile, hydrateProfile } = useAuth();
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const onboardingState = token && profile
    ? {
      required: profile.onboarding.required,
      completed: profile.onboarding.completed,
      profile: profile.onboarding.profile,
      occupations: [],
    }
    : null;
  const awaitingInitialResolution = Boolean(token) && !profile;

  const completeOnboardingAndHydrate = useCallback(async () => {
    setCompletingOnboarding(true);
    try {
      // POST /onboarding has already succeeded before this runs, so we can
      // optimistically release the onboarding gate while hydration catches up.
      if (profile?.onboarding.required) {
        hydrateProfile({
          ...profile,
          onboarding: {
            ...profile.onboarding,
            required: false,
            completed: true,
          },
        });
      }

      const [latestOnboardingResult, freshProfileResult] = await Promise.allSettled([
        apiFetch<OnboardingStatusResponse>("/api/bff/onboarding", {
          cacheTtlMs: 0,
          skipOnUnauthorized: true,
          timeoutMs: 20_000,
        }),
        apiFetch<UserProfile>(`/api/bff/me?onboardingComplete=${Date.now()}`, {
          cacheTtlMs: 0,
          skipOnUnauthorized: true,
          timeoutMs: 45_000,
        }),
      ]);

      const latestOnboarding = latestOnboardingResult.status === "fulfilled"
        ? latestOnboardingResult.value
        : null;
      const freshProfile = freshProfileResult.status === "fulfilled"
        ? freshProfileResult.value
        : null;

      if (freshProfile) {
        if (latestOnboarding && !latestOnboarding.required && freshProfile.onboarding.required) {
          hydrateProfile({
            ...freshProfile,
            onboarding: {
              required: false,
              completed: latestOnboarding.completed,
              profile: latestOnboarding.profile,
            },
          });
        } else {
          hydrateProfile(freshProfile);
        }
      } else if (latestOnboarding && !latestOnboarding.required && profile) {
        hydrateProfile({
          ...profile,
          onboarding: {
            required: false,
            completed: latestOnboarding.completed,
            profile: latestOnboarding.profile,
          },
        });
      }
    } finally {
      setCompletingOnboarding(false);
    }
  }, [hydrateProfile, profile]);

  const value = useMemo<OnboardingGateContextValue>(
    () => ({
      busy: isLoading || Boolean(token && (awaitingInitialResolution || completingOnboarding)),
      required: Boolean(token && onboardingState?.required),
      state: onboardingState ?? ONBOARDING_FALLBACK,
      completeOnboardingAndHydrate,
    }),
    [awaitingInitialResolution, completeOnboardingAndHydrate, completingOnboarding, isLoading, onboardingState, token]
  );

  return <OnboardingGateContext.Provider value={value}>{children}</OnboardingGateContext.Provider>;
}

export function useOnboardingGate() {
  const value = useContext(OnboardingGateContext);
  if (!value) {
    throw new Error("useOnboardingGate must be used within <OnboardingGateProvider>");
  }
  return value;
}