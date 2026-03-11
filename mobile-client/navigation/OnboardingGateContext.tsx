import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { OnboardingStatusResponse, Settings } from "@/lib/apiTypes";

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
  const { token, isLoading, profile, refreshProfile } = useAuth();
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const onboardingState = token ? (profile?.onboarding ?? null) : null;
  const awaitingInitialResolution = Boolean(token) && !profile;

  const completeOnboardingAndHydrate = useCallback(async () => {
    setCompletingOnboarding(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await Promise.all([
            apiFetch<Settings>("/api/bff/settings", { cacheTtlMs: 0, skipOnUnauthorized: true }),
            apiFetch(`/api/bff/expenses/summary?month=${month}&year=${year}&scope=pay_period`, {
              cacheTtlMs: 0,
              skipOnUnauthorized: true,
            }),
            apiFetch<OnboardingStatusResponse>("/api/bff/onboarding", { cacheTtlMs: 0, skipOnUnauthorized: true }),
          ]);
          break;
        } catch {
          if (attempt === 3) break;
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }

      try {
        await refreshProfile();
      } catch {}
    } finally {
      setCompletingOnboarding(false);
    }
  }, [refreshProfile]);

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