import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { UserProfile } from "@/lib/apiTypes";

type EmailVerificationGateContextValue = {
  busy: boolean;
  blocked: boolean;
  profile: UserProfile | null;
  refresh: () => Promise<void>;
};

const EmailVerificationGateContext = createContext<EmailVerificationGateContextValue | null>(null);

export function EmailVerificationGateProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = React.useCallback(async () => {
    if (!token) {
      setProfile(null);
      return;
    }

    setBusy(true);
    try {
      const next = await apiFetch<UserProfile>("/api/bff/me", {
        cacheTtlMs: 0,
        skipOnUnauthorized: true,
        timeoutMs: 15_000,
      });
      setProfile(next);
    } catch {
      setProfile(null);
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      setBusy(false);
      return;
    }

    void refresh();
  }, [refresh, token]);

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