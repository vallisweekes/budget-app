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
  refreshSettings: (options?: { force?: boolean }) => Promise<Settings | null>;
  ensureSettingsLoaded: () => Promise<Settings | null>;
};

const BootstrapDataContext = createContext<BootstrapDataContextValue | null>(null);

export function BootstrapDataProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: authLoading, profile } = useAuth();
  const onboarding = useOnboardingGate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
  const [shouldLoadDashboard, setShouldLoadDashboard] = useState(false);
  const [isRecoveringInitialLoad, setIsRecoveringInitialLoad] = useState(false);
  const shouldSkip = authLoading || !token || onboarding.busy || onboarding.required;

  const dashboardQuery = useGetDashboardQuery(undefined, { skip: shouldSkip || !shouldLoadDashboard });
  const settingsQuery = useGetSettingsQuery(undefined, { skip: shouldSkip });

  const dashboard = shouldSkip || !shouldLoadDashboard ? null : dashboardQuery.data ?? null;
  const settings = shouldSkip ? null : settingsQuery.data ?? profile?.settings ?? null;
  const hasSettingsData = Boolean(settings);
  const hasDashboardData = Boolean(dashboard);
  const shouldBlockInitialLoadUi = !authLoading && Boolean(token) && !onboarding.busy && !onboarding.required && !hasCompletedInitialLoad;
  const isWaitingForInitialSettings = !hasSettingsData && Boolean(settingsQuery.isLoading || settingsQuery.isFetching);
  const isWaitingForDashboard = shouldLoadDashboard && !hasDashboardData && Boolean(dashboardQuery.isLoading || dashboardQuery.isFetching);
  const isLoading = authLoading
    ? true
    : !token
      ? false
      : onboarding.busy || onboarding.required
        ? false
        : shouldBlockInitialLoadUi
          || isRecoveringInitialLoad
          || (!settingsQuery.error && isWaitingForInitialSettings)
          || (!dashboardQuery.error && isWaitingForDashboard);
  const error = useMemo<Error | null>(() => {
    const nextError = dashboardQuery.error ?? settingsQuery.error;
    if (!nextError) return null;
    if (!hasSettingsData && shouldBlockInitialLoadUi) return null;
    if (!hasSettingsData && isRecoveringInitialLoad) return null;
    if (hasDashboardData) return null;
    if (nextError instanceof Error) return nextError;
    return new Error("Failed to load app data");
  }, [dashboardQuery.error, hasDashboardData, hasSettingsData, isRecoveringInitialLoad, settingsQuery.error, shouldBlockInitialLoadUi]);
  const lastLoadedAt = useMemo<number | null>(() => {
    const dashboardStamp = shouldLoadDashboard ? dashboardQuery.fulfilledTimeStamp ?? 0 : 0;
    const settingsStamp = settingsQuery.fulfilledTimeStamp ?? 0;
    const nextStamp = Math.max(dashboardStamp, settingsStamp);
    return nextStamp > 0 ? nextStamp : null;
  }, [dashboardQuery.fulfilledTimeStamp, settingsQuery.fulfilledTimeStamp, shouldLoadDashboard]);

  const inflightRef = useRef<Promise<BootstrapRefreshResult> | null>(null);
  const settingsInflightRef = useRef<Promise<Settings | null> | null>(null);
  const pendingInitialLoadResolversRef = useRef<Array<(result: BootstrapRefreshResult) => void>>([]);
  const pendingSettingsResolversRef = useRef<Array<(settings: Settings | null) => void>>([]);
  const dashboardRef = useRef<DashboardData | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const authLoadingRef = useRef(authLoading);
  const tokenRef = useRef<string | null | undefined>(token);
  const onboardingBusyRef = useRef(onboarding.busy);
  const onboardingRequiredRef = useRef(onboarding.required);
  const shouldLoadDashboardRef = useRef(shouldLoadDashboard);
  const bootstrapQueriesBusyRef = useRef(false);
  const settingsQueryBusyRef = useRef(false);
  const hasSettingsDataRef = useRef(false);
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
    hasSettingsDataRef.current = hasSettingsData;
  }, [hasSettingsData]);

  useEffect(() => {
    hasDashboardDataRef.current = hasDashboardData;
  }, [hasDashboardData]);

  useEffect(() => {
    if (hasSettingsData) {
      setHasCompletedInitialLoad((prev) => (prev ? prev : true));
      setIsRecoveringInitialLoad(false);
      stopInitialRetryLoop();
    }
  }, [hasSettingsData, stopInitialRetryLoop]);

  useEffect(() => {
    authLoadingRef.current = authLoading;
  }, [authLoading]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    shouldLoadDashboardRef.current = shouldLoadDashboard;
  }, [shouldLoadDashboard]);

  useEffect(() => {
    if (activeTokenRef.current === token) return;
    activeTokenRef.current = token;
    stopInitialRetryLoop();
    setShouldLoadDashboard(false);
    setIsRecoveringInitialLoad(false);
    setHasCompletedInitialLoad(false);
    setIsRefreshing(false);
    inflightRef.current = null;
    settingsInflightRef.current = null;
    pendingInitialLoadResolversRef.current = [];
    pendingSettingsResolversRef.current = [];
  }, [stopInitialRetryLoop, token]);

  useEffect(() => {
    onboardingBusyRef.current = onboarding.busy;
  }, [onboarding.busy]);

  useEffect(() => {
    onboardingRequiredRef.current = onboarding.required;
  }, [onboarding.required]);

  useEffect(() => {
    settingsQueryBusyRef.current = !shouldSkip && Boolean(settingsQuery.isLoading || settingsQuery.isFetching);
  }, [settingsQuery.isFetching, settingsQuery.isLoading, shouldSkip]);

  useEffect(() => {
    bootstrapQueriesBusyRef.current = !shouldSkip && Boolean(
      settingsQuery.isLoading
      || settingsQuery.isFetching
      || (shouldLoadDashboard && (dashboardQuery.isLoading || dashboardQuery.isFetching))
    );
  }, [dashboardQuery.isFetching, dashboardQuery.isLoading, settingsQuery.isFetching, settingsQuery.isLoading, shouldLoadDashboard, shouldSkip]);

  useEffect(() => {
    const settingsStillBusy = !shouldSkip && Boolean(settingsQuery.isLoading || settingsQuery.isFetching);
    if (settingsStillBusy) return;

    if (pendingSettingsResolversRef.current.length === 0) return;

    const resolvedSettings = settingsRef.current;
    const resolvers = pendingSettingsResolversRef.current.splice(0);
    settingsInflightRef.current = null;
    resolvers.forEach((resolve) => resolve(resolvedSettings));
  }, [settings, settingsQuery.isFetching, settingsQuery.isLoading, shouldSkip]);

  useEffect(() => {
    const queriesStillBusy = !shouldSkip && Boolean(
      settingsQuery.isLoading
      || settingsQuery.isFetching
      || (shouldLoadDashboard && (dashboardQuery.isLoading || dashboardQuery.isFetching))
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
  }, [dashboard, dashboardQuery.isFetching, dashboardQuery.isLoading, settings, settingsQuery.isFetching, settingsQuery.isLoading, shouldLoadDashboard, shouldSkip]);

  const refreshSettings = useCallback(
    async (options?: { force?: boolean }): Promise<Settings | null> => {
      const currentSettings = settingsRef.current;
      const currentAuthLoading = authLoadingRef.current;
      const currentToken = tokenRef.current;
      const currentOnboardingBusy = onboardingBusyRef.current;
      const currentOnboardingRequired = onboardingRequiredRef.current;

      if (currentAuthLoading) return currentSettings;
      if (!currentToken) return null;
      if (currentOnboardingBusy || currentOnboardingRequired) {
        return currentSettings;
      }

      const force = options?.force === true;

      if (!force && currentSettings) {
        return currentSettings;
      }

      if (settingsInflightRef.current) return settingsInflightRef.current;

      if (!force && !currentSettings && settingsQueryBusyRef.current) {
        const promise = new Promise<Settings | null>((resolve) => {
          pendingSettingsResolversRef.current.push(resolve);
        });
        settingsInflightRef.current = promise;
        return promise;
      }

      const promise = (async () => {
        try {
          const result = await settingsQuery.refetch();
          if (result.error) {
            throw result.error;
          }

          return result.data ?? null;
        } catch {
          return currentSettings;
        } finally {
          settingsInflightRef.current = null;
        }
      })();

      settingsInflightRef.current = promise;
      return promise;
    },
    [settingsQuery]
  );

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

      const force = options?.force === true;
      const hasData = Boolean(currentDashboard && currentSettings);
      const queriesBusy = bootstrapQueriesBusyRef.current;
      const dashboardRequested = shouldLoadDashboardRef.current;
      const needsDashboardBootstrap = !dashboardRequested;

      if (!force && hasData) {
        return { dashboard: currentDashboard, settings: currentSettings };
      }

      if (inflightRef.current) return inflightRef.current;

      if (needsDashboardBootstrap) {
        setShouldLoadDashboard(true);
      }

      if (needsDashboardBootstrap || (!force && !hasData && queriesBusy)) {
        const promise = new Promise<BootstrapRefreshResult>((resolve) => {
          pendingInitialLoadResolversRef.current.push(resolve);
        });
        inflightRef.current = promise;

        if (force || !currentSettings) {
          void refreshSettings({ force: true });
        }

        return promise;
      }

      const promise = (async () => {
        if (hasData) setIsRefreshing(true);

        try {
          const [dashResult, nextSettings] = await Promise.all([
            dashboardQuery.refetch(),
            force || !currentSettings
              ? refreshSettings({ force })
              : Promise.resolve(currentSettings),
          ]);

          if (dashResult.error) {
            throw dashResult.error;
          }

          return {
            dashboard: dashResult.data ?? null,
            settings: nextSettings ?? null,
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
    [dashboardQuery, refreshSettings]
  );

  const ensureSettingsLoaded = useCallback(async (): Promise<Settings | null> => {
    return await refreshSettings({ force: false });
  }, [refreshSettings]);

  const ensureLoaded = useCallback(async (): Promise<BootstrapRefreshResult> => {
    return await refresh({ force: false });
  }, [refresh]);

  useEffect(() => {
    return subscribeToApiMutations(() => {
      if (authLoadingRef.current) return;
      if (!tokenRef.current) return;
      if (onboardingBusyRef.current || onboardingRequiredRef.current) return;

      if (hasDashboardDataRef.current) {
        void refresh({ force: true });
        return;
      }

      void refreshSettings({ force: true });
    });
  }, [refresh, refreshSettings]);

  useEffect(() => {
    if (shouldSkip) {
      stopInitialRetryLoop();
      setIsRecoveringInitialLoad(false);
      return;
    }

    if (hasSettingsData) {
      stopInitialRetryLoop();
      setIsRecoveringInitialLoad(false);
      return;
    }

    const nextError = settingsQuery.error;
    if (!nextError || isNoBudgetPlanError(nextError) || !shouldBlockInitialLoadUi) {
      stopInitialRetryLoop();
      setIsRecoveringInitialLoad(false);
      return;
    }

    setIsRecoveringInitialLoad(true);

    if (!initialRetryIntervalRef.current) {
      void refreshSettings({ force: true });
      initialRetryIntervalRef.current = setInterval(() => {
        if (!tokenRef.current) return;
        if (onboardingBusyRef.current || onboardingRequiredRef.current) return;
        if (hasSettingsDataRef.current) return;
        void refreshSettings({ force: true });
      }, 1500);
    }

    return () => {
      if (hasSettingsDataRef.current || shouldSkip || !shouldBlockInitialLoadUi) {
        stopInitialRetryLoop();
      }
    };
  }, [hasSettingsData, refreshSettings, settingsQuery.error, shouldBlockInitialLoadUi, shouldSkip, stopInitialRetryLoop]);

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      stopInitialRetryLoop();
      setShouldLoadDashboard(false);
      setHasCompletedInitialLoad(false);
      setIsRecoveringInitialLoad(false);
      setIsRefreshing(false);
      inflightRef.current = null;
      settingsInflightRef.current = null;
      pendingInitialLoadResolversRef.current = [];
      pendingSettingsResolversRef.current = [];
      return;
    }
  }, [authLoading, stopInitialRetryLoop, token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) return;
    if (onboarding.busy || onboarding.required) return;

    const onChange = (next: AppStateStatus) => {
      if (next !== "active") return;
      if (!lastLoadedAt) return;
      const ageMs = Date.now() - lastLoadedAt;
      if (ageMs <= 15_000) return;

      if (hasDashboardDataRef.current) {
        void refresh({ force: true });
        return;
      }

      void refreshSettings({ force: true });
    };

    const sub = AppState.addEventListener("change", onChange);
    return () => {
      sub.remove();
    };
  }, [authLoading, lastLoadedAt, onboarding.busy, onboarding.required, refresh, refreshSettings, token]);

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
      refreshSettings,
      ensureSettingsLoaded,
    }),
    [dashboard, ensureLoaded, ensureSettingsLoaded, error, isLoading, isRecoveringInitialLoad, isRefreshing, lastLoadedAt, refresh, refreshSettings, settings]
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
