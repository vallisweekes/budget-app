import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
  getStoredUsername,
  setStoredUsername,
  clearStoredUsername,
} from "@/lib/storage";
import { getApiBaseUrl } from "@/lib/api";

type AuthState = {
  token: string | null;
  username: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (username: string, mode?: "login" | "register") => Promise<void>;
  signOut: () => Promise<void>;
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
    Promise.all([getSessionToken(), getStoredUsername()])
      .then(([token, username]) => {
        setState({ token, username, isLoading: false });
      })
      .catch(() => {
        setState((s) => ({ ...s, isLoading: false }));
      });
  }, []);

  const signIn = useCallback(
    async (usernameInput: string, mode: "login" | "register" = "login") => {
      const baseUrl = getApiBaseUrl();

      // 1. Fetch CSRF token required by NextAuth credentials flow
      const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
      if (!csrfRes.ok) throw new Error("Could not reach the API — check your URL.");
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

      // 2. POST credentials to NextAuth
      const body = new URLSearchParams({
        csrfToken,
        username: usernameInput.trim(),
        mode,
        json: "true",
      });

      const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        redirect: "manual",
      });

      // 3. Extract session-token cookie from Set-Cookie header
      const setCookie =
        res.headers.get("set-cookie") ??
        (res as unknown as { _bodyInit?: string })._bodyInit ??
        "";

      const match =
        setCookie.match(/next-auth\.session-token=([^;,\s]+)/i) ??
        // production uses __Secure- prefix on https
        setCookie.match(/__Secure-next-auth\.session-token=([^;,\s]+)/i);

      if (!match?.[1]) {
        throw new Error("Sign in failed — invalid username or server unreachable.");
      }

      const sessionToken = match[1];
      await Promise.all([
        setSessionToken(sessionToken),
        setStoredUsername(usernameInput.trim()),
      ]);

      setState({ token: sessionToken, username: usernameInput.trim(), isLoading: false });
    },
    []
  );

  const signOut = useCallback(async () => {
    await Promise.all([clearSessionToken(), clearStoredUsername()]);
    setState({ token: null, username: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
