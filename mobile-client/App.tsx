import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { DefaultTheme, NavigationContainer, type InitialState, type Theme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as ReduxProvider } from "react-redux";
import { StatusBar } from "expo-status-bar";
import { registerRootComponent } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { store } from "@/store";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { applyThemeMode, type ThemeMode, T } from "@/lib/theme";
import { getStoredThemeMode } from "@/lib/storage";
import { installGlobalTypographyWeightNormalizer } from "@/lib/typography";
import { navigationRef } from "@/navigation/navigationRef";

installGlobalTypographyWeightNormalizer();

const NAV_PERSIST_VERSION = "v1";
const NAV_LAST_KEY = `budget_app.nav_state.last_key.${NAV_PERSIST_VERSION}`;

function navStateKeyForUser(username: string | null): string | null {
  const u = (username ?? "").trim().toLowerCase();
  if (!u) return null;
  return `budget_app.nav_state.${NAV_PERSIST_VERSION}.${u}`;
}

function AuthedNavigation({
  navTheme,
  booting,
  RootNavigator,
}: {
  navTheme: Theme;
  booting: boolean;
  RootNavigator: React.ComponentType | null;
}) {
  const { token, username, isLoading } = useAuth();
  const [navBooting, setNavBooting] = useState(true);
  const [initialNavState, setInitialNavState] = useState<InitialState | undefined>(undefined);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string>("");
  const remoteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRemoteJsonRef = useRef<string>("");

  const persistKey = useMemo(() => navStateKeyForUser(username), [username]);

  useEffect(() => {
    let mounted = true;
    if (booting || isLoading) return;

    (async () => {
      // If signed out, clear the last saved state to avoid restoring into a different user.
      if (!token) {
        try {
          const lastKey = await AsyncStorage.getItem(NAV_LAST_KEY);
          if (lastKey) await AsyncStorage.removeItem(lastKey);
          await AsyncStorage.removeItem(NAV_LAST_KEY);
        } catch {
          // ignore
        }
        if (mounted) {
          setInitialNavState(undefined);
          setNavBooting(false);
        }
        return;
      }

      // Only restore when we can key it to a specific user.
      if (!persistKey) {
        if (mounted) {
          setInitialNavState(undefined);
          setNavBooting(false);
        }
        return;
      }

      try {
        let raw = await AsyncStorage.getItem(persistKey);

        // If local state is missing (e.g. first launch on a new device), try the server.
        if (!raw) {
          const remote = await apiFetch<{ stateJson: string | null }>("/api/bff/navigation/state", {
            cacheTtlMs: 0,
            skipOnUnauthorized: true,
          });
          raw = typeof remote?.stateJson === "string" ? remote.stateJson : "";
          if (raw) {
            await AsyncStorage.setItem(persistKey, raw);
          }
        }

        if (raw) {
          const parsed = JSON.parse(raw) as InitialState;
          if (mounted) setInitialNavState(parsed);
        }

        await AsyncStorage.setItem(NAV_LAST_KEY, persistKey);
      } catch {
        // ignore (bad JSON / storage errors / network errors)
      } finally {
        if (mounted) setNavBooting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [booting, isLoading, persistKey, token]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      if (remoteSaveTimerRef.current) clearTimeout(remoteSaveTimerRef.current);
      remoteSaveTimerRef.current = null;
    };
  }, []);

  const onStateChange = useCallback(
    (state: unknown) => {
      if (!token) return;
      if (!persistKey) return;
      if (!state) return;

      let json = "";
      try {
        json = JSON.stringify(state);
      } catch {
        return;
      }
      if (!json || json === lastSavedJsonRef.current) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        lastSavedJsonRef.current = json;
        void AsyncStorage.setItem(persistKey, json);
        void AsyncStorage.setItem(NAV_LAST_KEY, persistKey);
      }, 250);

      // Cross-device sync: debounced remote save.
      if (json === lastRemoteJsonRef.current) return;
      if (remoteSaveTimerRef.current) clearTimeout(remoteSaveTimerRef.current);
      remoteSaveTimerRef.current = setTimeout(() => {
        lastRemoteJsonRef.current = json;
        void apiFetch("/api/bff/navigation/state", {
          method: "PUT",
          body: { stateJson: json },
          cacheTtlMs: 0,
          skipOnUnauthorized: true,
        }).catch(() => {
          // ignore
        });
      }, 2000);
    },
    [persistKey, token]
  );

  return (
    <NavigationContainer theme={navTheme} ref={navigationRef} initialState={initialNavState} onStateChange={onStateChange}>
      {booting || navBooting || isLoading || !RootNavigator ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: T.bg }}>
          <RootNavigator />
        </View>
      )}
    </NavigationContainer>
  );
}

function App() {
  const [booting, setBooting] = useState(true);
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await getStoredThemeMode();
        const next = stored ?? "dark";
        applyThemeMode(next);
        if (mounted) setMode(next);
      } finally {
        if (mounted) setBooting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const RootNavigator = useMemo(() => {
    if (booting) return null;
    // Require after theme is applied so module-level styles pick up the right tokens.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@/navigation/RootNavigator").default as React.ComponentType;
  }, [booting, mode]);

  const navTheme: Theme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: mode === "dark",
      colors: {
        ...DefaultTheme.colors,
        primary: T.accent,
        background: T.bg,
        card: T.card,
        text: T.text,
        border: T.border,
        notification: T.accent,
      },
    }),
    [mode]
  );

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: T.bg }}>
      <ReduxProvider store={store}>
        <AuthProvider>
				<AuthedNavigation navTheme={navTheme} booting={booting} RootNavigator={RootNavigator} />
          <StatusBar style={mode === "dark" ? "light" : "dark"} />
        </AuthProvider>
      </ReduxProvider>
    </SafeAreaProvider>
  );
}

registerRootComponent(App);
export default App;
