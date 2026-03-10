import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, type AppStateStatus, StyleSheet, View } from "react-native";
import { DefaultTheme, ThemeProvider, type Theme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as ReduxProvider } from "react-redux";
import { Redirect, Stack, useGlobalSearchParams, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

import { store } from "@/store";
import { ActiveBudgetPlanProvider } from "@/context/ActiveBudgetPlanContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { BootstrapDataProvider } from "@/context/BootstrapDataContext";
import { PushNotificationsBootstrap } from "@/components/Shared/PushNotificationsBootstrap";
import { applyThemeMode, type ThemeMode, T } from "@/lib/theme";
import { getStoredThemeMode } from "@/lib/storage";
import { installGlobalTypographyWeightNormalizer } from "@/lib/typography";
import { OnboardingGateProvider } from "@/navigation/OnboardingGateContext";
import { useOnboardingGate } from "@/navigation/OnboardingGateContext";
import { buildPersistedHref, clearPersistedRoute, flushPersistedHrefRemote, savePersistedHrefLocal } from "@/navigation/routePersistence";

installGlobalTypographyWeightNormalizer();

void SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore
});

function NavigationPersistenceObserver() {
  const { token, username, isLoading } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const lastSavedHrefRef = useRef("");
  const lastRemoteHrefRef = useRef("");
  const pendingRemoteHrefRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameRef = useRef<string | null>(username);
  const tokenRef = useRef(token);

  const href = useMemo(() => buildPersistedHref(pathname, params), [params, pathname]);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      pendingRemoteHrefRef.current = "";
      lastSavedHrefRef.current = "";
      lastRemoteHrefRef.current = "";
      void clearPersistedRoute(username);
      return;
    }

    if (!href || href === "/" || href === "/login" || href === "/onboarding" || href === "/Login" || href === "/Onboarding") {
      return;
    }

    if (href === lastSavedHrefRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastSavedHrefRef.current = href;
      void savePersistedHrefLocal(username, href);
    }, 250);

    pendingRemoteHrefRef.current = href;
  }, [href, isLoading, token, username]);

  const flushRemoteState = useCallback(() => {
    const nextHref = pendingRemoteHrefRef.current;
    const nextToken = tokenRef.current;
    const nextUsername = usernameRef.current;

    if (!nextToken || !nextUsername || !nextHref) return;
    if (nextHref === lastRemoteHrefRef.current) return;

    lastRemoteHrefRef.current = nextHref;
    void flushPersistedHrefRemote(nextUsername, nextHref).catch(() => {
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
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [flushRemoteState]);

  return null;
}

function useSessionRouteGuardState() {
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const { token, isLoading } = useAuth();
  const onboarding = useOnboardingGate();

  const rootSegment = typeof segments[0] === "string" ? segments[0] : "";
  const childSegment = typeof segments[1] === "string" ? segments[1] : "";
  const inAuthGroup = rootSegment === "(auth)" || pathname === "/login" || pathname === "/onboarding";
  const onOnboardingRoute = (rootSegment === "(auth)" && childSegment === "onboarding") || pathname === "/onboarding";

  if (isLoading || (token && onboarding.busy)) {
    return { mode: "loading" as const };
  }

  if (!token) {
    return inAuthGroup ? { mode: "ready" as const } : { mode: "redirect" as const, href: "/(auth)/login" };
  }

  if (onboarding.required) {
    return onOnboardingRoute
      ? { mode: "ready" as const }
      : { mode: "redirect" as const, href: "/(auth)/onboarding" };
  }

  if (inAuthGroup || pathname === "/") {
    return { mode: "redirect" as const, href: "/(tabs)/dashboard" };
  }

  return { mode: "ready" as const };
}

function RootShell() {
  const [booting, setBooting] = useState(true);
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [splashVisible, setSplashVisible] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const guard = useSessionRouteGuardState();

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

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }} onLayout={onRootLayout}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  if (guard.mode === "loading") {
    return (
      <ThemeProvider value={navTheme}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }} onLayout={onRootLayout}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      </ThemeProvider>
    );
  }

  if (guard.mode === "redirect") {
    return (
      <ThemeProvider value={navTheme}>
        <Redirect href={guard.href} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <View style={{ flex: 1 }} onLayout={onRootLayout}>
        <NavigationPersistenceObserver />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(modals)" options={{ headerShown: false }} />
          <Stack.Screen name="settings-profile-details" options={{ headerShown: false }} />
          <Stack.Screen name="settings-income-settings" options={{ headerShown: false }} />
          <Stack.Screen name="settings-debt-management" options={{ headerShown: false }} />
          <Stack.Screen name="settings-strategy" options={{ headerShown: false }} />
          <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />

        {splashVisible ? (
          <Animated.Image
            source={require("../assets/splash.png")}
            resizeMode="cover"
            style={[StyleSheet.absoluteFill, styles.splash, { opacity: splashOpacity }]}
          />
        ) : null}
      </View>
    </ThemeProvider>
  );
}

export default function ExpoRootLayout() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: T.bg }}>
      <ReduxProvider store={store}>
        <AuthProvider>
          <OnboardingGateProvider>
            <BootstrapDataProvider>
              <ActiveBudgetPlanProvider>
                <PushNotificationsBootstrap />
                <RootShell />
              </ActiveBudgetPlanProvider>
            </BootstrapDataProvider>
          </OnboardingGateProvider>
        </AuthProvider>
      </ReduxProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    width: "100%",
    height: "100%",
  },
});