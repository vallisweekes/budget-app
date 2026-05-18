import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { useBootstrapData } from "@/context/BootstrapDataContext";

type ActiveBudgetPlanContextValue = {
  activeBudgetPlanId: string | null;
  bootstrapBudgetPlanId: string | null;
  hasExplicitSelection: boolean;
  setActiveBudgetPlanId: (budgetPlanId: string | null) => void;
  clearActiveBudgetPlanId: () => void;
};

const ActiveBudgetPlanContext = createContext<ActiveBudgetPlanContextValue | null>(null);

export function ActiveBudgetPlanProvider({ children }: { children: React.ReactNode }) {
  const { token, profile } = useAuth();
  const { dashboard, settings } = useBootstrapData();
  const bootstrapBudgetPlanId = settings?.id ?? dashboard?.budgetPlanId ?? null;
  const [explicitBudgetPlanId, setExplicitBudgetPlanId] = useState<string | null>(null);

  const availablePlanIds = useMemo(
    () => new Set((profile?.plans ?? []).map((plan) => plan.id)),
    [profile?.plans],
  );

  useEffect(() => {
    setExplicitBudgetPlanId((prev) => {
      if (!prev) return prev;
      if (!token) return null;
      if (prev === bootstrapBudgetPlanId) return null;
      if (availablePlanIds.size === 0) return prev;
      return availablePlanIds.has(prev) ? prev : null;
    });
  }, [availablePlanIds, bootstrapBudgetPlanId, token]);

  const setActiveBudgetPlanId = useCallback((budgetPlanId: string | null) => {
    const normalized = typeof budgetPlanId === "string" && budgetPlanId.trim().length > 0
      ? budgetPlanId.trim()
      : null;

    setExplicitBudgetPlanId((prev) => {
      const next = normalized === bootstrapBudgetPlanId ? null : normalized;
      return prev === next ? prev : next;
    });
  }, [bootstrapBudgetPlanId]);

  const clearActiveBudgetPlanId = useCallback(() => {
    setExplicitBudgetPlanId((prev) => (prev === null ? prev : null));
  }, []);

  const value = useMemo<ActiveBudgetPlanContextValue>(() => ({
    activeBudgetPlanId: explicitBudgetPlanId ?? bootstrapBudgetPlanId,
    bootstrapBudgetPlanId,
    hasExplicitSelection: explicitBudgetPlanId !== null,
    setActiveBudgetPlanId,
    clearActiveBudgetPlanId,
  }), [bootstrapBudgetPlanId, clearActiveBudgetPlanId, explicitBudgetPlanId, setActiveBudgetPlanId]);

  return <ActiveBudgetPlanContext.Provider value={value}>{children}</ActiveBudgetPlanContext.Provider>;
}

export function useActiveBudgetPlan(): ActiveBudgetPlanContextValue {
  const ctx = useContext(ActiveBudgetPlanContext);
  if (!ctx) {
    throw new Error("useActiveBudgetPlan must be used within ActiveBudgetPlanProvider");
  }
  return ctx;
}