import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { ApiError, apiFetch } from "@/lib/api";
import type { DashboardData, Settings } from "@/lib/apiTypes";
import { useAuth } from "@/context/AuthContext";

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

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const inflightRef = useRef<Promise<BootstrapRefreshResult> | null>(null);

  const doFetch = useCallback(async (): Promise<BootstrapRefreshResult> => {
    // Fetch computed dashboard + settings in parallel.
    const [dash, s] = await Promise.all([
      apiFetch<DashboardData>("/api/bff/dashboard", { cacheTtlMs: 0 }),
      apiFetch<Settings>("/api/bff/settings"),
    ]);

    setDashboard(dash);
    setSettings(s);
    setLastLoadedAt(Date.now());
    return { dashboard: dash, settings: s };
  }, []);

  const refresh = useCallback(
    async (options?: { force?: boolean }): Promise<BootstrapRefreshResult> => {
      if (authLoading) return { dashboard, settings };
      if (!token) return { dashboard: null, settings: null };

      const hasData = Boolean(dashboard && settings);
      const force = options?.force === true;

      if (!force && hasData) {
        return { dashboard, settings };
      }

      if (inflightRef.current) return inflightRef.current;

      const promise = (async () => {
        setError(null);
        if (!hasData) setIsLoading(true);
        else setIsRefreshing(true);

        try {
          return await doFetch();
        } catch (err: unknown) {
          const e = err instanceof Error ? err : new Error("Failed to load");
          setError(e);
          return { dashboard, settings };
        } finally {
          setIsLoading(false);
          setIsRefreshing(false);
          inflightRef.current = null;
        }
      })();

      inflightRef.current = promise;
      return promise;
    },
    [authLoading, dashboard, doFetch, settings, token]
  );

  const ensureLoaded = useCallback(async (): Promise<BootstrapRefreshResult> => {
    return await refresh({ force: false });
  }, [refresh]);

  // Reset on sign-out and bootstrap on sign-in.
  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setDashboard(null);
      setSettings(null);
      setError(null);
      setLastLoadedAt(null);
      setIsLoading(false);
      setIsRefreshing(false);
      inflightRef.current = null;
      return;
    }

    void refresh({ force: true });
  }, [authLoading, refresh, token]);

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
