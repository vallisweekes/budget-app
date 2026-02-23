import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { DefaultTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as ReduxProvider } from "react-redux";
import { StatusBar } from "expo-status-bar";
import { registerRootComponent } from "expo";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from "@expo-google-fonts/inter";

import { store } from "@/store";
import { AuthProvider } from "@/context/AuthContext";
import { applyThemeMode, type ThemeMode, T } from "@/lib/theme";
import { getStoredThemeMode } from "@/lib/storage";
import { installInterGlobalTypography } from "@/lib/typography";

function App() {
  const [booting, setBooting] = useState(true);
  const [mode, setMode] = useState<ThemeMode>("dark");

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    installInterGlobalTypography({
      regular: "Inter_400Regular",
      medium: "Inter_500Medium",
      semibold: "Inter_600SemiBold",
      bold: "Inter_700Bold",
      extrabold: "Inter_800ExtraBold",
      black: "Inter_900Black",
    });
  }, [fontsLoaded]);

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
    if (booting || !fontsLoaded) return null;
    // Require after theme is applied so module-level styles pick up the right tokens.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@/navigation/RootNavigator").default as React.ComponentType;
  }, [booting, mode, fontsLoaded]);

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
          <NavigationContainer theme={navTheme}>
            {booting || !fontsLoaded || !RootNavigator ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
                <ActivityIndicator size="large" color={T.accent} />
              </View>
            ) : (
              <View style={{ flex: 1, backgroundColor: T.bg }}>
                <RootNavigator />
              </View>
            )}
          </NavigationContainer>
          <StatusBar style={mode === "dark" ? "light" : "dark"} />
        </AuthProvider>
      </ReduxProvider>
    </SafeAreaProvider>
  );
}

registerRootComponent(App);
export default App;
