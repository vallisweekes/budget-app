import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, type AppStateStatus, StyleSheet, View } from "react-native";
import { DefaultTheme, NavigationContainer, NavigationIndependentTree, type InitialState, type Theme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as ReduxProvider } from "react-redux";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";

import { store } from "@/store";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { BootstrapDataProvider } from "@/context/BootstrapDataContext";
import { PushNotificationsBootstrap } from "@/components/Shared/PushNotificationsBootstrap";
import { apiFetch } from "@/lib/api";
import { applyThemeMode, type ThemeMode, T } from "@/lib/theme";
import { getStoredThemeMode } from "@/lib/storage";
import { installGlobalTypographyWeightNormalizer } from "@/lib/typography";
import { navigationRef } from "@/navigation/navigationRef";

installGlobalTypographyWeightNormalizer();

void SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore
});

const NAV_PERSIST_VERSION = "v1";
const NAV_LAST_KEY = `budget_app.nav_state.last_key.${NAV_PERSIST_VERSION}`;

function navStateKeyForUser(username: string | null): string | null {
  const normalizedUsername = (username ?? "").trim().toLowerCase();
  if (!normalizedUsername) return null;
  return `budget_app.nav_state.${NAV_PERSIST_VERSION}.${normalizedUsername}`;
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
  const persistKey = useMemo(() => navStateKeyForUser(username), [username]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef("");
  const lastRemoteJsonRef = useRef("");
  const pendingRemoteJsonRef = useRef("");
  const tokenRef = useRef(token);
  const persistKeyRef = useRef(persistKey);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    persistKeyRef.current = persistKey;
  }, [persistKey]);

  useEffect(() => {
    let mounted = true;
    if (booting || isLoading) return;

    void (async () => {
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

      if (!persistKey) {
        if (mounted) {
          setInitialNavState(undefined);
          setNavBooting(false);
        }
        return;
      }

      try {
        let raw = await AsyncStorage.getItem(persistKey);

        if (!raw) {
          const remote = await apiFetch<{ stateJson: string | null }>("/api/bff/navigation/state", {
            cacheTtlMs: 0,
            skipOnUnauthorized: true,
          });
          raw = typeof remote?.stateJson === "string" ? remote.stateJson : "";
          if (raw) {
            await AsyncStorage.setItem(persistKey, raw);
            lastSavedJsonRef.current = raw;
            lastRemoteJsonRef.current = raw;
            pendingRemoteJsonRef.current = raw;
          }
        }

        if (raw) {
          const parsed = JSON.parse(raw) as InitialState;
          if (mounted) setInitialNavState(parsed);
          lastSavedJsonRef.current = raw;
          lastRemoteJsonRef.current = raw;
          pendingRemoteJsonRef.current = raw;
        }

        await AsyncStorage.setItem(NAV_LAST_KEY, persistKey);
      } catch {
        // ignore
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
    };
  }, []);

  const flushRemoteState = useCallback(() => {
    const nextJson = pendingRemoteJsonRef.current;
    const nextToken = tokenRef.current;
    const nextPersistKey = persistKeyRef.current;

    if (!nextToken || !nextPersistKey || !nextJson) return;
    if (nextJson === lastRemoteJsonRef.current) return;

    lastRemoteJsonRef.current = nextJson;
    void apiFetch("/api/bff/navigation/state", {
      method: "PUT",
      body: { stateJson: nextJson },
      cacheTtlMs: 0,
      skipOnUnauthorized: true,
    }).catch(() => {
      // ignore
    });
  }, []);

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "inactive" || nextState === "background") {
        flushRemoteState();
      }
    };

    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => {
      sub.remove();
    };
  }, [flushRemoteState]);

  const onStateChange = useCallback(
    (state: unknown) => {
      if (!token || !persistKey || !state) return;

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

      pendingRemoteJsonRef.current = json;
    },
    [persistKey, token]
  );

  return (
    <NavigationIndependentTree>
      <NavigationContainer
        theme={navTheme}
        ref={navigationRef}
        initialState={initialNavState}
        onStateChange={onStateChange}
      >
        {booting || navBooting || isLoading || !RootNavigator ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : (
          <View style={{ flex: 1, backgroundColor: T.bg }}>
            <BootstrapDataProvider>
              <RootNavigator />
            </BootstrapDataProvider>
          </View>
        )}
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

export default function LegacyAppRoot() {
  const [booting, setBooting] = useState(true);
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [splashVisible, setSplashVisible] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const stored = await getStoredThemeMode();
        const nextMode = stored ?? "dark";
        applyThemeMode(nextMode);
        if (mounted) setMode(nextMode);
      } finally {
        if (mounted) setBooting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const onRootLayout = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => {
      // ignore
    });
  }, []);

  useEffect(() => {
    if (booting) return;

    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 450,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setSplashVisible(false);
    });
  }, [booting, splashOpacity]);

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
      <View style={{ flex: 1 }} onLayout={onRootLayout}>
        <ReduxProvider store={store}>
          <AuthProvider>
            <PushNotificationsBootstrap />
            <AuthedNavigation navTheme={navTheme} booting={booting} RootNavigator={RootNavigator} />
            <StatusBar style={mode === "dark" ? "light" : "dark"} />
          </AuthProvider>
        </ReduxProvider>

        {splashVisible ? (
          <Animated.Image
            source={require("../assets/splash.png")}
            resizeMode="cover"
            style={[StyleSheet.absoluteFill, styles.splash, { opacity: splashOpacity }]}
          />
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    width: "100%",
    height: "100%",
  },
});