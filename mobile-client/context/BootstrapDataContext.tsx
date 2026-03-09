import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { ApiError } from "@/lib/api";
import type { DashboardData, Settings } from "@/lib/apiTypes";
import { useAuth } from "@/context/AuthContext";
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
  error: Error | null;
  lastLoadedAt: number | null;
  refresh: (options?: { force?: boolean }) => Promise<BootstrapRefreshResult>;
  ensureLoaded: () => Promise<BootstrapRefreshResult>;
};

const BootstrapDataContext = createContext<BootstrapDataContextValue | null>(null);

export function BootstrapDataProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: authLoading } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const shouldSkip = authLoading || !token;

  const dashboardQuery = useGetDashboardQuery(undefined, { skip: shouldSkip, refetchOnMountOrArgChange: true });
  const settingsQuery = useGetSettingsQuery(undefined, { skip: shouldSkip, refetchOnMountOrArgChange: true });

  const dashboard = shouldSkip ? null : dashboardQuery.data ?? null;
  const settings = shouldSkip ? null : settingsQuery.data ?? null;
  const hasBootstrapData = Boolean(dashboard && settings);
  const isLoading = authLoading
    ? true
    : !token
      ? false
      : !dashboardQuery.error && !settingsQuery.error && Boolean(
        dashboardQuery.isLoading
        || settingsQuery.isLoading
        || !hasBootstrapData
      );
  const error = useMemo<Error | null>(() => {
    const nextError = dashboardQuery.error ?? settingsQuery.error;
    if (!nextError) return null;
    if (nextError instanceof Error) return nextError;
    return new Error("Failed to load app data");
  }, [dashboardQuery.error, settingsQuery.error]);
  const lastLoadedAt = useMemo<number | null>(() => {
    const dashboardStamp = dashboardQuery.fulfilledTimeStamp ?? 0;
    const settingsStamp = settingsQuery.fulfilledTimeStamp ?? 0;
    const nextStamp = Math.max(dashboardStamp, settingsStamp);
    return nextStamp > 0 ? nextStamp : null;
  }, [dashboardQuery.fulfilledTimeStamp, settingsQuery.fulfilledTimeStamp]);

  const inflightRef = useRef<Promise<BootstrapRefreshResult> | null>(null);
  const dashboardRef = useRef<DashboardData | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const authLoadingRef = useRef(authLoading);
  const tokenRef = useRef<string | null | undefined>(token);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    authLoadingRef.current = authLoading;
  }, [authLoading]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const refresh = useCallback(
    async (options?: { force?: boolean }): Promise<BootstrapRefreshResult> => {
      const currentDashboard = dashboardRef.current;
      const currentSettings = settingsRef.current;
      const currentAuthLoading = authLoadingRef.current;
      const currentToken = tokenRef.current;

      if (currentAuthLoading) return { dashboard: currentDashboard, settings: currentSettings };
      if (!currentToken) return { dashboard: null, settings: null };

      const hasData = Boolean(currentDashboard && currentSettings);
      const force = options?.force === true;

      if (!force && hasData) {
        return { dashboard: currentDashboard, settings: currentSettings };
      }

      if (inflightRef.current) return inflightRef.current;

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

  // Reset on sign-out and bootstrap on sign-in.
  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setIsRefreshing(false);
      inflightRef.current = null;
      return;
    }
  }, [authLoading, token]);

  // Opportunistic refresh when app returns to foreground.
  useEffect(() => {
    if (authLoading) return;
    if (!token) return;

    const onChange = (next: AppStateStatus) => {
      if (next !== "active") return;
      if (!lastLoadedAt) {
        void refresh({ force: true });
        return;
      }
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
  }, [authLoading, lastLoadedAt, refresh, token]);

  const value = useMemo<BootstrapDataContextValue>(
    () => ({
      dashboard,
      settings,
      isLoading,
      isRefreshing,
      error,
      lastLoadedAt,
      refresh,
      ensureLoaded,
    }),
    [dashboard, ensureLoaded, error, isLoading, isRefreshing, lastLoadedAt, refresh, settings]
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
