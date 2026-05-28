import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { apiFetch } from "@/lib/api";
import type { DashboardVersionData } from "@/lib/apiTypes";

const DEFAULT_POLL_INTERVAL_MS = 15_000;

type UseBudgetPlanVersionRefreshParams = {
  enabled: boolean;
  budgetPlanId: string | null | undefined;
  onVersionChange: () => void | Promise<void>;
  intervalMs?: number;
};

export function useBudgetPlanVersionRefresh(params: UseBudgetPlanVersionRefreshParams): void {
  const {
    enabled,
    budgetPlanId,
    onVersionChange,
    intervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = params;

  const versionRef = useRef<string | null>(null);
  const versionCheckBusyRef = useRef(false);
  const onVersionChangeRef = useRef(onVersionChange);

  useEffect(() => {
    onVersionChangeRef.current = onVersionChange;
  }, [onVersionChange]);

  const readVersion = useCallback(async (): Promise<DashboardVersionData | null> => {
    if (!enabled || !budgetPlanId || versionCheckBusyRef.current) {
      return null;
    }

    versionCheckBusyRef.current = true;

    try {
      return await apiFetch<DashboardVersionData>(
        `/api/bff/dashboard/version?budgetPlanId=${encodeURIComponent(budgetPlanId)}`,
        { cacheTtlMs: 0, timeoutMs: 5_000 },
      );
    } catch {
      return null;
    } finally {
      versionCheckBusyRef.current = false;
    }
  }, [budgetPlanId, enabled]);

  useEffect(() => {
    versionRef.current = null;

    if (!enabled || !budgetPlanId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const versionData = await readVersion();
      if (cancelled || !versionData?.version) return;
      versionRef.current = versionData.version;
    })();

    return () => {
      cancelled = true;
    };
  }, [budgetPlanId, enabled, readVersion]);

  useEffect(() => {
    if (!enabled || !budgetPlanId) {
      return;
    }

    const intervalId = setInterval(() => {
      if (AppState.currentState !== "active") return;

      void (async () => {
        const versionData = await readVersion();
        if (!versionData?.version) return;

        const previousVersion = versionRef.current;
        if (!previousVersion) {
          versionRef.current = versionData.version;
          return;
        }

        if (previousVersion === versionData.version) return;

        versionRef.current = versionData.version;
        void onVersionChangeRef.current();
      })();
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [budgetPlanId, enabled, intervalMs, readVersion]);
}

export default useBudgetPlanVersionRefresh;