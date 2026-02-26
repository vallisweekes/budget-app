import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
  setStoredUsername,
  clearStoredUsername,
} from "@/lib/storage";
import { apiFetch, getApiBaseUrl, invalidateApiCache, setOnUnauthorized } from "@/lib/api";
import { PushNotificationsBootstrap } from "@/components/Shared/PushNotificationsBootstrap";

type AuthState = {
  token: string | null;
  username: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (username: string, mode?: "login" | "register", email?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type ProfileMeResponse = {
  username?: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    username: null,
    isLoading: true,
  });

  // Rehydrate from secure store on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getSessionToken();
        if (!token) {
          setState({ token: null, username: null, isLoading: false });
          return;
        }

        const profile = await apiFetch<ProfileMeResponse>("/api/bff/me", { cacheTtlMs: 0 });
        const username = typeof profile?.username === "string" ? profile.username.trim() : "";
        await setStoredUsername(username);
        setState({ token, username: username || null, isLoading: false });
      } catch {
        await Promise.all([clearSessionToken(), clearStoredUsername()]);
        invalidateApiCache();
        setState({ token: null, username: null, isLoading: false });
      }
    })();
  }, []);

  const signIn = useCallback(
    async (usernameInput: string, mode: "login" | "register" = "login", emailInput = "") => {
      const baseUrl = getApiBaseUrl();
      const username = usernameInput.trim();
      const email = emailInput.trim();

      if (mode === "register") {
        await Promise.all([clearSessionToken(), clearStoredUsername()]);
        invalidateApiCache();
        setState({ token: null, username: null, isLoading: false });
      }

      const res = await fetch(`${baseUrl}/api/mobile-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          mode,
        }),
      });

      const parsed = (await res.json().catch(() => null)) as { token?: unknown; username?: unknown; error?: unknown } | null;
      if (!res.ok) {
        const serverError = typeof parsed?.error === "string" ? parsed.error : "";
        if (mode === "register") {
          throw new Error(serverError || "Registration failed. Please try again.");
        }
        throw new Error(serverError || "Sign in failed — invalid username or server unreachable.");
      }

      const sessionToken = typeof parsed?.token === "string" ? parsed.token : "";
      if (!sessionToken) {
        throw new Error("Sign in failed — missing session token.");
      }

      const sessionUsernameRaw = typeof parsed?.username === "string" ? parsed.username : username;
      const sessionUsername = sessionUsernameRaw.trim() || username;

      await Promise.all([setSessionToken(sessionToken), setStoredUsername(sessionUsername)]);

      invalidateApiCache();
      setState({ token: sessionToken, username: sessionUsername, isLoading: false });
    },
    []
  );

  const signOut = useCallback(async () => {
    await Promise.all([clearSessionToken(), clearStoredUsername()]);
    invalidateApiCache();
    setState({ token: null, username: null, isLoading: false });
  }, []);

  // Register a global callback so apiFetch can trigger sign-out on 401
  useEffect(() => {
    setOnUnauthorized(() => {
      // Fire-and-forget: clear stale session so the navigator redirects to login
      void signOut();
    });
    return () => setOnUnauthorized(null);
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      <PushNotificationsBootstrap />
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
