import React, { createContext, useContext, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import type { UserProfile } from "@/lib/apiTypes";

type EmailVerificationGateContextValue = {
  busy: boolean;
  blocked: boolean;
  profile: UserProfile | null;
  refresh: () => Promise<void>;
};

const EmailVerificationGateContext = createContext<EmailVerificationGateContextValue | null>(null);

export function EmailVerificationGateProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  const refresh = React.useCallback(async () => {
    if (!token) return;

    setBusy(true);
    try {
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  }, [refreshProfile, token]);

  const value = useMemo<EmailVerificationGateContextValue>(() => ({
    busy: isLoading || busy,
    blocked: Boolean(token && profile?.emailVerificationBlocked),
    profile,
    refresh,
  }), [busy, isLoading, profile, refresh, token]);

  return <EmailVerificationGateContext.Provider value={value}>{children}</EmailVerificationGateContext.Provider>;
}

export function useEmailVerificationGate() {
  const value = useContext(EmailVerificationGateContext);
  if (!value) {
    throw new Error("useEmailVerificationGate must be used within <EmailVerificationGateProvider>");
  }
  return value;
}