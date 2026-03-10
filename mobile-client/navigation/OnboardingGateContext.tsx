import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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
  const { token, isLoading } = useAuth();
  const [onboardingState, setOnboardingState] = useState<OnboardingStatusResponse | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const lastOnboardingTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      lastOnboardingTokenRef.current = null;
      setOnboardingState((prev) => (prev === null ? prev : null));
      setOnboardingLoading((prev) => (prev ? false : prev));
      return;
    }

    lastOnboardingTokenRef.current = token;
    setOnboardingState((prev) => (prev === null ? prev : null));
    setOnboardingLoading(true);

    void (async () => {
      try {
        const data = await apiFetch<OnboardingStatusResponse>("/api/bff/onboarding", {
          cacheTtlMs: 0,
          skipOnUnauthorized: true,
          timeoutMs: 15_000,
        });
        if (!cancelled) {
          setOnboardingState(data);
        }
      } catch {
        if (!cancelled) {
          setOnboardingState((prev) => (prev === ONBOARDING_FALLBACK ? prev : ONBOARDING_FALLBACK));
        }
      } finally {
        if (!cancelled) setOnboardingLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const awaitingInitialResolution = Boolean(token) && onboardingState === null;

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
        const latest = await apiFetch<OnboardingStatusResponse>("/api/bff/onboarding", {
          cacheTtlMs: 0,
          skipOnUnauthorized: true,
        });
        setOnboardingState((prev) => {
          if (
            prev?.required === latest.required
            && prev?.completed === latest.completed
            && prev?.profile === latest.profile
            && prev?.occupations === latest.occupations
          ) {
            return prev;
          }
          return latest;
        });
      } catch {
        setOnboardingState((prev) => (prev === ONBOARDING_FALLBACK ? prev : ONBOARDING_FALLBACK));
      }
    } finally {
      setCompletingOnboarding(false);
    }
  }, []);

  const value = useMemo<OnboardingGateContextValue>(
    () => ({
      busy: isLoading || Boolean(token && (awaitingInitialResolution || onboardingLoading || completingOnboarding)),
      required: Boolean(token && onboardingState?.required),
      state: onboardingState ?? ONBOARDING_FALLBACK,
      completeOnboardingAndHydrate,
    }),
    [awaitingInitialResolution, completeOnboardingAndHydrate, completingOnboarding, isLoading, onboardingLoading, onboardingState, token]
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