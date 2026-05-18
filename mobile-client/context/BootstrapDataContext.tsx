import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { ApiError, subscribeToApiMutations } from "@/lib/api";
import type { DashboardData, Settings } from "@/lib/apiTypes";
import { useAuth } from "@/context/AuthContext";
import { useOnboardingGate } from "@/navigation/OnboardingGateContext";
import { useGetDashboardQuery, useGetSettingsQuery } from "@/store/api";

export type BootstrapRefreshResult = {
  dashboard: DashboardData | null;
  settings: Settings | null;
};

type BootstrapDataContextValue = {
  dashboard: DashboardData | null;
  settings: Settings | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isRecoveringInitialLoad: boolean;
  error: Error | null;
  lastLoadedAt: number | null;
  refresh: (options?: { force?: boolean }) => Promise<BootstrapRefreshResult>;
  ensureLoaded: () => Promise<BootstrapRefreshResult>;
};

const BootstrapDataContext = createContext<BootstrapDataContextValue | null>(null);

export function BootstrapDataProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: authLoading, profile } = useAuth();
  const onboarding = useOnboardingGate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
  const shouldSkip = authLoading || !token || onboarding.busy || onboarding.required;

  const dashboardQuery = useGetDashboardQuery(undefined, { skip: shouldSkip });
  const settingsQuery = useGetSettingsQuery(undefined, { skip: shouldSkip });
  const [isRecoveringInitialLoad, setIsRecoveringInitialLoad] = useState(false);

  const dashboard = shouldSkip ? null : dashboardQuery.data ?? null;
  const settings = shouldSkip ? null : settingsQuery.data ?? profile?.settings ?? null;
  const hasDashboardData = Boolean(dashboard);
  const shouldBlockInitialLoadUi = !authLoading && Boolean(token) && !onboarding.busy && !onboarding.required && !hasCompletedInitialLoad;
  const isWaitingForInitialDashboard = !hasDashboardData && Boolean(
    dashboardQuery.isLoading
    || dashboardQuery.isFetching
    || settingsQuery.isLoading
    || settingsQuery.isFetching
  );
  const isLoading = authLoading
    ? true
    : !token
      ? false
      : onboarding.busy || onboarding.required
        ? false
        : shouldBlockInitialLoadUi || isRecoveringInitialLoad || (!dashboardQuery.error && !settingsQuery.error && isWaitingForInitialDashboard);
  const error = useMemo<Error | null>(() => {
    const nextError = dashboardQuery.error ?? settingsQuery.error;
    if (!nextError) return null;
    if (shouldBlockInitialLoadUi) return null;
    if (isRecoveringInitialLoad) return null;
    if (hasDashboardData) return null;
    if (nextError instanceof Error) return nextError;
    return new Error("Failed to load app data");
  }, [dashboardQuery.error, hasDashboardData, isRecoveringInitialLoad, settingsQuery.error, shouldBlockInitialLoadUi]);
  const lastLoadedAt = useMemo<number | null>(() => {
    const dashboardStamp = dashboardQuery.fulfilledTimeStamp ?? 0;
    const settingsStamp = settingsQuery.fulfilledTimeStamp ?? 0;
    const nextStamp = Math.max(dashboardStamp, settingsStamp);
    return nextStamp > 0 ? nextStamp : null;
  }, [dashboardQuery.fulfilledTimeStamp, settingsQuery.fulfilledTimeStamp]);

  const inflightRef = useRef<Promise<BootstrapRefreshResult> | null>(null);
  const pendingInitialLoadResolversRef = useRef<Array<(result: BootstrapRefreshResult) => void>>([]);
  const dashboardRef = useRef<DashboardData | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const authLoadingRef = useRef(authLoading);
  const tokenRef = useRef<string | null | undefined>(token);
  const onboardingBusyRef = useRef(onboarding.busy);
  const onboardingRequiredRef = useRef(onboarding.required);
  const bootstrapQueriesBusyRef = useRef(false);
  const hasDashboardDataRef = useRef(false);
  const initialRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTokenRef = useRef<string | null | undefined>(token);

  const stopInitialRetryLoop = useCallback(() => {
    if (!initialRetryIntervalRef.current) return;
    clearInterval(initialRetryIntervalRef.current);
    initialRetryIntervalRef.current = null;
  }, []);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    hasDashboardDataRef.current = hasDashboardData;
  }, [hasDashboardData]);

  useEffect(() => {
    if (hasDashboardData) {
      setHasCompletedInitialLoad((prev) => (prev ? prev : true));
      setIsRecoveringInitialLoad(false);
      stopInitialRetryLoop();
    }
  }, [hasDashboardData, stopInitialRetryLoop]);

  useEffect(() => {
    authLoadingRef.current = authLoading;
  }, [authLoading]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (activeTokenRef.current === token) return;
    activeTokenRef.current = token;
    stopInitialRetryLoop();
    setIsRecoveringInitialLoad(false);
    setHasCompletedInitialLoad(false);
  }, [stopInitialRetryLoop, token]);

  useEffect(() => {
    onboardingBusyRef.current = onboarding.busy;
  }, [onboarding.busy]);

  useEffect(() => {
    onboardingRequiredRef.current = onboarding.required;
  }, [onboarding.required]);

  useEffect(() => {
    bootstrapQueriesBusyRef.current = !shouldSkip && Boolean(
      dashboardQuery.isLoading
      || dashboardQuery.isFetching
      || settingsQuery.isLoading
      || settingsQuery.isFetching
    );
  }, [dashboardQuery.isFetching, dashboardQuery.isLoading, settingsQuery.isFetching, settingsQuery.isLoading, shouldSkip]);

  useEffect(() => {
    const queriesStillBusy = !shouldSkip && Boolean(
      dashboardQuery.isLoading
      || dashboardQuery.isFetching
      || settingsQuery.isLoading
      || settingsQuery.isFetching
    );
    if (queriesStillBusy) return;

    if (pendingInitialLoadResolversRef.current.length === 0) return;

    const result = {
      dashboard: dashboardRef.current,
      settings: settingsRef.current,
    };
    const resolvers = pendingInitialLoadResolversRef.current.splice(0);
    inflightRef.current = null;
    resolvers.forEach((resolve) => resolve(result));
  }, [dashboard, dashboardQuery.isFetching, dashboardQuery.isLoading, settings, settingsQuery.isFetching, settingsQuery.isLoading, shouldSkip]);

  const refresh = useCallback(
    async (options?: { force?: boolean }): Promise<BootstrapRefreshResult> => {
      const currentDashboard = dashboardRef.current;
      const currentSettings = settingsRef.current;
      const currentAuthLoading = authLoadingRef.current;
      const currentToken = tokenRef.current;
      const currentOnboardingBusy = onboardingBusyRef.current;
      const currentOnboardingRequired = onboardingRequiredRef.current;

      if (currentAuthLoading) return { dashboard: currentDashboard, settings: currentSettings };
      if (!currentToken) return { dashboard: null, settings: null };
      if (currentOnboardingBusy || currentOnboardingRequired) {
        return { dashboard: currentDashboard, settings: currentSettings };
      }

      const hasData = Boolean(currentDashboard && currentSettings);
      const force = options?.force === true;
      const queriesBusy = bootstrapQueriesBusyRef.current;

      if (!force && hasData) {
        return { dashboard: currentDashboard, settings: currentSettings };
      }

      if (inflightRef.current) return inflightRef.current;

      if (!force && !hasData && queriesBusy) {
        const promise = new Promise<BootstrapRefreshResult>((resolve) => {
          pendingInitialLoadResolversRef.current.push(resolve);
        });
        inflightRef.current = promise;
        return promise;
      }

      const promise = (async () => {
        if (hasData) setIsRefreshing(true);

        try {
          const [dashResult, settingsResult] = await Promise.all([
            dashboardQuery.refetch(),
            settingsQuery.refetch(),
          ]);

          if (dashResult.error) {
            throw dashResult.error;
          }
          if (settingsResult.error) {
            throw settingsResult.error;
          }

          return {
            dashboard: dashResult.data ?? null,
            settings: settingsResult.data ?? null,
          };
        } catch {
          return { dashboard: currentDashboard, settings: currentSettings };
        } finally {
          setIsRefreshing(false);
          inflightRef.current = null;
        }
      })();

      inflightRef.current = promise;
      return promise;
    },
    [dashboardQuery, settingsQuery]
  );

  const ensureLoaded = useCallback(async (): Promise<BootstrapRefreshResult> => {
    return await refresh({ force: false });
  }, [refresh]);

  useEffect(() => {
    return subscribeToApiMutations(() => {
      if (authLoadingRef.current) return;
      if (!tokenRef.current) return;
      if (onboardingBusyRef.current || onboardingRequiredRef.current) return;
      if (!hasDashboardDataRef.current) return;
      void refresh({ force: true });
    });
  }, [refresh]);

  useEffect(() => {
    if (shouldSkip) {
      stopInitialRetryLoop();
      setIsRecoveringInitialLoad(false);
      return;
    }

    if (hasDashboardData) {
      stopInitialRetryLoop();
      setIsRecoveringInitialLoad(false);
      return;
    }

    const nextError = dashboardQuery.error ?? settingsQuery.error;
    if (!nextError || isNoBudgetPlanError(nextError) || !shouldBlockInitialLoadUi) {
      stopInitialRetryLoop();
      setIsRecoveringInitialLoad(false);
      return;
    }

    setIsRecoveringInitialLoad(true);

    if (!initialRetryIntervalRef.current) {
      void refresh({ force: true });
      initialRetryIntervalRef.current = setInterval(() => {
        if (!tokenRef.current) return;
        if (onboardingBusyRef.current || onboardingRequiredRef.current) return;
        if (hasDashboardDataRef.current) return;
        void refresh({ force: true });
      }, 1500);
    }

    return () => {
      if (hasDashboardDataRef.current || shouldSkip || !shouldBlockInitialLoadUi) {
        stopInitialRetryLoop();
      }
    };
  }, [dashboardQuery.error, hasDashboardData, refresh, settingsQuery.error, shouldBlockInitialLoadUi, shouldSkip, stopInitialRetryLoop]);

  // Reset on sign-out and bootstrap on sign-in.
  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      stopInitialRetryLoop();
      setHasCompletedInitialLoad(false);
      setIsRecoveringInitialLoad(false);
      setIsRefreshing(false);
      inflightRef.current = null;
      return;
    }
  }, [authLoading, stopInitialRetryLoop, token]);

  // Opportunistic refresh when app returns to foreground.
  useEffect(() => {
    if (authLoading) return;
    if (!token) return;
    if (onboarding.busy || onboarding.required) return;

    const onChange = (next: AppStateStatus) => {
      if (next !== "active") return;
      if (!lastLoadedAt) return;
      // Avoid hammering the API when users switch apps quickly.
      const ageMs = Date.now() - lastLoadedAt;
      if (ageMs > 15_000) {
        void refresh({ force: true });
      }
    };

    const sub = AppState.addEventListener("change", onChange);
    return () => {
      sub.remove();
    };
  }, [authLoading, lastLoadedAt, onboarding.busy, onboarding.required, refresh, token]);

  const value = useMemo<BootstrapDataContextValue>(
    () => ({
      dashboard,
      settings,
      isLoading,
      isRefreshing,
      isRecoveringInitialLoad,
      error,
      lastLoadedAt,
      refresh,
      ensureLoaded,
    }),
    [dashboard, ensureLoaded, error, isLoading, isRecoveringInitialLoad, isRefreshing, lastLoadedAt, refresh, settings]
  );

  return <BootstrapDataContext.Provider value={value}>{children}</BootstrapDataContext.Provider>;
}

export function useBootstrapData(): BootstrapDataContextValue {
  const ctx = useContext(BootstrapDataContext);
  if (!ctx) {
    throw new Error("useBootstrapData must be used within BootstrapDataProvider");
  }
  return ctx;
}

export function isNoBudgetPlanError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 404 &&
    /budget plan not found/i.test(err.message)
  );
}
