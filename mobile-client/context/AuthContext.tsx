import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
  getPendingRegistration,
  setPendingRegistration,
  clearPendingRegistration,
  setStoredUsername,
  clearStoredUsername,
  type PendingRegistrationDraft,
} from "@/lib/storage";
import { apiFetch, getApiBaseUrl, invalidateApiCache, setOnUnauthorized, suppressUnauthorizedCallback } from "@/lib/api";
import type { OnboardingProfile, UserProfile } from "@/lib/apiTypes";
import { store } from "@/store";
import { mobileApi } from "@/store/api";

type AuthState = {
  token: string | null;
  username: string | null;
  profile: UserProfile | null;
  pendingRegistration: PendingRegistrationDraft | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (username: string, mode?: "login" | "register", email?: string) => Promise<void>;
  prepareRegistration: (username: string, email: string) => Promise<void>;
  completeRegistration: (profile: Partial<OnboardingProfile>) => Promise<void>;
  updatePendingRegistrationProfile: (profile: Partial<OnboardingProfile>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  hydrateProfile: (profile: UserProfile | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

let rehydrateMeInFlight: Promise<UserProfile> | null = null;
let rehydrateMeToken: string | null = null;
let rehydrateMeCachedProfile: UserProfile | null = null;
const AUTH_PROFILE_TIMEOUT_MS = 45_000;

function fetchRehydrateProfileOnce(token: string): Promise<UserProfile> {
  if (rehydrateMeCachedProfile && rehydrateMeToken === token) {
    return Promise.resolve(rehydrateMeCachedProfile);
  }

  if (rehydrateMeInFlight && rehydrateMeToken === token) {
    return rehydrateMeInFlight;
  }

  rehydrateMeToken = token;
  rehydrateMeInFlight = apiFetch<UserProfile>("/api/bff/me", {
    cacheTtlMs: 0,
    skipOnUnauthorized: true,
    timeoutMs: AUTH_PROFILE_TIMEOUT_MS,
  })
    .then((profile) => {
      rehydrateMeCachedProfile = profile;
      return profile;
    })
    .finally(() => {
      rehydrateMeInFlight = null;
    });

  return rehydrateMeInFlight;
}

function clearRehydrateProfileCache() {
  rehydrateMeInFlight = null;
  rehydrateMeToken = null;
  rehydrateMeCachedProfile = null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    username: null,
    profile: null,
    pendingRegistration: null,
    isLoading: true,
  });
  const signOutInFlightRef = useRef(false);
  const didRehydrateRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const usernameRef = useRef<string | null>(null);
  const pendingRegistrationRef = useRef<PendingRegistrationDraft | null>(null);
  const meRequestInFlightRef = useRef<Promise<UserProfile> | null>(null);

  type MobileAuthResponse = {
    token?: unknown;
    username?: unknown;
    profile?: UserProfile | null;
    error?: unknown;
  };

  const fetchMeOnce = useCallback((): Promise<UserProfile> => {
    if (meRequestInFlightRef.current) return meRequestInFlightRef.current;

    const request = apiFetch<UserProfile>("/api/bff/me", {
      cacheTtlMs: 0,
      skipOnUnauthorized: true,
      timeoutMs: AUTH_PROFILE_TIMEOUT_MS,
    }).finally(() => {
      meRequestInFlightRef.current = null;
    });

    meRequestInFlightRef.current = request;
    return request;
  }, []);

  const seedBootstrapCaches = useCallback((profile: UserProfile | null) => {
    if (!profile?.settings) return;
    store.dispatch(mobileApi.util.upsertQueryData("getSettings", undefined, profile.settings));
    if (Array.isArray(profile.plans)) {
      store.dispatch(mobileApi.util.upsertQueryData("getBudgetPlans", undefined, { plans: profile.plans }));
    }
  }, []);

  const setAuthState = useCallback((next: AuthState) => {
    setState((prev) => (
      prev.token === next.token
      && prev.username === next.username
      && prev.profile === next.profile
      && prev.pendingRegistration === next.pendingRegistration
      && prev.isLoading === next.isLoading
        ? prev
        : next
    ));
  }, []);

  useEffect(() => {
    tokenRef.current = state.token;
  }, [state.token]);

  useEffect(() => {
    usernameRef.current = state.username;
  }, [state.username]);

  useEffect(() => {
    pendingRegistrationRef.current = state.pendingRegistration;
  }, [state.pendingRegistration]);

  const hydrateProfile = useCallback((profile: UserProfile | null) => {
    const username = typeof profile?.username === "string" ? profile.username.trim() : "";
    const nextUsername = username || usernameRef.current || null;
    if (nextUsername) {
      void setStoredUsername(nextUsername);
    }

    seedBootstrapCaches(profile);

    setAuthState({
      token: tokenRef.current,
      username: nextUsername,
      profile,
      pendingRegistration: null,
      isLoading: false,
    });
  }, [seedBootstrapCaches, setAuthState]);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    const token = await getSessionToken();
    if (!token) return null;

    const currentProfile = state.profile;
    const currentUsername = usernameRef.current;

    try {
      if (rehydrateMeCachedProfile && rehydrateMeToken === token) {
        const profile = rehydrateMeCachedProfile;
        const username = typeof profile?.username === "string" ? profile.username.trim() : "";
        const nextUsername = username || currentUsername || null;
        if (nextUsername) {
          await setStoredUsername(nextUsername);
        }
        seedBootstrapCaches(profile);
        setAuthState({ token, username: nextUsername, profile, pendingRegistration: null, isLoading: false });
        return profile;
      }

      const profile = await fetchMeOnce();
      const username = typeof profile?.username === "string" ? profile.username.trim() : "";
      const nextUsername = username || currentUsername || null;
      if (nextUsername) {
        await setStoredUsername(nextUsername);
      }
      seedBootstrapCaches(profile);
      setAuthState({ token, username: nextUsername, profile, pendingRegistration: null, isLoading: false });
      return profile;
    } catch {
      return currentProfile;
    }
  }, [fetchMeOnce, seedBootstrapCaches, setAuthState, state.profile]);

  // Rehydrate from secure store on mount
  useEffect(() => {
    if (didRehydrateRef.current) return;
    didRehydrateRef.current = true;

    (async () => {
      // Suppress auto-sign-out during rehydration — a stale token 401 should
      // just clear silently, not race with a concurrent sign-in.
      suppressUnauthorizedCallback(true);
      try {
        const pendingRegistration = await getPendingRegistration();
        const token = await getSessionToken();
        if (!token) {
          clearRehydrateProfileCache();
          setAuthState({
            token: null,
            username: pendingRegistration?.username ?? null,
            profile: null,
            pendingRegistration,
            isLoading: false,
          });
          return;
        }

        const profile = await fetchRehydrateProfileOnce(token);
        const username = typeof profile?.username === "string" ? profile.username.trim() : "";
        await setStoredUsername(username);
        if (pendingRegistration) {
          await clearPendingRegistration();
        }
        seedBootstrapCaches(profile);
        setAuthState({ token, username: username || null, profile, pendingRegistration: null, isLoading: false });
      } catch {
        const pendingRegistration = await getPendingRegistration();
        await Promise.all([clearSessionToken(), clearStoredUsername()]);
        clearRehydrateProfileCache();
        invalidateApiCache();
        store.dispatch(mobileApi.util.resetApiState());
        setAuthState({
          token: null,
          username: pendingRegistration?.username ?? null,
          profile: null,
          pendingRegistration,
          isLoading: false,
        });
      } finally {
        suppressUnauthorizedCallback(false);
      }
    })();
  }, [fetchMeOnce, seedBootstrapCaches, setAuthState]);

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
          await Promise.all([clearSessionToken(), clearStoredUsername(), clearPendingRegistration()]);
          clearRehydrateProfileCache();
          invalidateApiCache();
          setAuthState({ token: null, username: null, profile: null, pendingRegistration: null, isLoading: false });
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

        const parsed = (await res.json().catch(() => null)) as MobileAuthResponse | null;
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

        const profile = await fetchMeOnce();
        const profileUsername = typeof profile?.username === "string" ? profile.username.trim() : "";

        invalidateApiCache();
        clearRehydrateProfileCache();
        await clearPendingRegistration();
        store.dispatch(mobileApi.util.resetApiState());
        seedBootstrapCaches(profile);
        setAuthState({
          token: sessionToken,
          username: profileUsername || sessionUsername,
          profile,
          pendingRegistration: null,
          isLoading: false,
        });
      } finally {
        // Re-enable 401 auto-sign-out only after the new token is safely persisted.
        suppressUnauthorizedCallback(false);
      }
    },
    [fetchMeOnce, seedBootstrapCaches, setAuthState]
  );

  const prepareRegistration = useCallback(async (usernameInput: string, emailInput: string) => {
    const baseUrl = getApiBaseUrl();
    const username = usernameInput.trim();
    const email = emailInput.trim().toLowerCase();

    suppressUnauthorizedCallback(true);
    try {
      await Promise.all([clearSessionToken(), clearStoredUsername(), clearPendingRegistration()]);
      clearRehydrateProfileCache();
      invalidateApiCache();
      store.dispatch(mobileApi.util.resetApiState());

      const res = await fetch(`${baseUrl}/api/mobile-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          mode: "register_check",
        }),
      });

      const parsed = (await res.json().catch(() => null)) as MobileAuthResponse | null;
      if (!res.ok) {
        const serverError = typeof parsed?.error === "string" ? parsed.error : "";
        throw new Error(serverError || "Registration failed. Please try again.");
      }

      const nextPendingRegistration: PendingRegistrationDraft = {
        username,
        email,
        profile: null,
      };

      await setPendingRegistration(nextPendingRegistration);
      setAuthState({
        token: null,
        username,
        profile: null,
        pendingRegistration: nextPendingRegistration,
        isLoading: false,
      });
    } finally {
      suppressUnauthorizedCallback(false);
    }
  }, [setAuthState]);

  const updatePendingRegistrationProfile = useCallback(async (profileUpdate: Partial<OnboardingProfile>) => {
    const currentPendingRegistration = pendingRegistrationRef.current;
    if (!currentPendingRegistration) return;

    const nextPendingRegistration: PendingRegistrationDraft = {
      ...currentPendingRegistration,
      profile: {
        ...(currentPendingRegistration.profile ?? {}),
        ...profileUpdate,
      },
    };

    setAuthState({
      token: null,
      username: nextPendingRegistration.username,
      profile: null,
      pendingRegistration: nextPendingRegistration,
      isLoading: false,
    });
    await setPendingRegistration(nextPendingRegistration);
  }, [setAuthState]);

  const completeRegistration = useCallback(async (profileInput: Partial<OnboardingProfile>) => {
    const baseUrl = getApiBaseUrl();
    const pendingRegistration = pendingRegistrationRef.current ?? await getPendingRegistration();

    if (!pendingRegistration) {
      throw new Error("Registration session expired. Please start again.");
    }

    suppressUnauthorizedCallback(true);
    try {
      const res = await fetch(`${baseUrl}/api/mobile-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: pendingRegistration.username,
          email: pendingRegistration.email,
          mode: "register_complete",
          onboarding: profileInput,
        }),
      });

      const parsed = (await res.json().catch(() => null)) as MobileAuthResponse | null;
      if (!res.ok) {
        const serverError = typeof parsed?.error === "string" ? parsed.error : "";
        throw new Error(serverError || "Could not complete onboarding. Please try again.");
      }

      const sessionToken = typeof parsed?.token === "string" ? parsed.token : "";
      if (!sessionToken) {
        throw new Error("Could not complete onboarding. Missing session token.");
      }

      const completedProfile = parsed?.profile ?? null;
      if (!completedProfile) {
        throw new Error("Could not complete onboarding. Missing profile data.");
      }

      const sessionUsername = typeof parsed?.username === "string"
        ? parsed.username.trim() || pendingRegistration.username
        : pendingRegistration.username;

      await Promise.all([
        setSessionToken(sessionToken),
        setStoredUsername(sessionUsername),
        clearPendingRegistration(),
      ]);

      invalidateApiCache();
      clearRehydrateProfileCache();
      store.dispatch(mobileApi.util.resetApiState());
      seedBootstrapCaches(completedProfile);
      setAuthState({
        token: sessionToken,
        username: sessionUsername,
        profile: completedProfile,
        pendingRegistration: null,
        isLoading: false,
      });
    } finally {
      suppressUnauthorizedCallback(false);
    }
  }, [seedBootstrapCaches, setAuthState]);

  const signOut = useCallback(async () => {
    if (signOutInFlightRef.current) return;
    signOutInFlightRef.current = true;

    // Snapshot the token at the start of sign-out. If a concurrent signIn saves a
    // new token before we finish, we abort so we don't wipe the fresh session.
    const tokenSnapshot = await getSessionToken();

    try {
      suppressUnauthorizedCallback(true);

      await Promise.all([clearSessionToken(), clearStoredUsername(), clearPendingRegistration()]);
      clearRehydrateProfileCache();
      invalidateApiCache();
      store.dispatch(mobileApi.util.resetApiState());
      setAuthState({ token: null, username: null, profile: null, pendingRegistration: null, isLoading: false });

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
    } finally {
      suppressUnauthorizedCallback(false);
      signOutInFlightRef.current = false;
    }
  }, [setAuthState]);

  // Register a global callback so apiFetch can trigger sign-out on 401
  useEffect(() => {
    setOnUnauthorized(() => {
      // Fire-and-forget: clear stale session so the navigator redirects to login
      void signOut();
    });
    return () => setOnUnauthorized(null);
  }, [signOut]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        prepareRegistration,
        completeRegistration,
        updatePendingRegistrationProfile,
        signOut,
        refreshProfile,
        hydrateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
