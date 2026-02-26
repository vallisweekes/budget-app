import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
  setStoredUsername,
  clearStoredUsername,
} from "@/lib/storage";
import { apiFetch, getApiBaseUrl, invalidateApiCache, setOnUnauthorized, suppressUnauthorizedCallback } from "@/lib/api";
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
      // Suppress auto-sign-out during rehydration — a stale token 401 should
      // just clear silently, not race with a concurrent sign-in.
      suppressUnauthorizedCallback(true);
      try {
        const token = await getSessionToken();
        if (!token) {
          setState({ token: null, username: null, isLoading: false });
          return;
        }

        const profile = await apiFetch<ProfileMeResponse>("/api/bff/me", { cacheTtlMs: 0, skipOnUnauthorized: true });
        const username = typeof profile?.username === "string" ? profile.username.trim() : "";
        await setStoredUsername(username);
        setState({ token, username: username || null, isLoading: false });
      } catch {
        await Promise.all([clearSessionToken(), clearStoredUsername()]);
        invalidateApiCache();
        setState({ token: null, username: null, isLoading: false });
      } finally {
        suppressUnauthorizedCallback(false);
      }
    })();
  }, []);

  const signIn = useCallback(
    async (usernameInput: string, mode: "login" | "register" = "login", emailInput = "") => {
      const baseUrl = getApiBaseUrl();
      const username = usernameInput.trim();
      const email = emailInput.trim();

      // Prevent any 401-triggered auto-sign-out from firing during the sign-in flow.
      // This guards against a race where a stale rehydration 401 fires signOut() while
      // the fresh sign-in is writing the new token to SecureStore.
      suppressUnauthorizedCallback(true);
      try {

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
      } finally {
        // Re-enable 401 auto-sign-out only after the new token is safely persisted.
        suppressUnauthorizedCallback(false);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    // Snapshot the token at the start of sign-out. If a concurrent signIn saves a
    // new token before we finish, we abort so we don't wipe the fresh session.
    const tokenSnapshot = await getSessionToken();

    try {
      if (tokenSnapshot) {
        const baseUrl = getApiBaseUrl();
        await fetch(`${baseUrl}/api/mobile-auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenSnapshot}`,
            Cookie: `next-auth.session-token=${tokenSnapshot}`,
          },
        });
      }
    } catch {
      // Ignore network/server failures during logout; local sign-out still proceeds.
    }

    // Abort if a fresher token was stored while we were awaiting above.
    // This prevents a stale 401 sign-out from killing a just-logged-in session.
    const currentToken = await getSessionToken();
    if (tokenSnapshot !== currentToken) {
      return;
    }

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
