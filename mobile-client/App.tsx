import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { apiFetch } from "./src/lib/api";
import BottomTabs, { type TabKey } from "./src/components/BottomTabs";
import DashboardNativeScreen from "./src/screens/DashboardNativeScreen";
import NativePlaceholderScreen from "./src/screens/NativePlaceholderScreen";
import WebScreen from "./src/screens/WebScreen";

export default function App() {
  const baseUrl = useMemo(() => {
    const raw = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim();
    return raw.replace(/\/$/, "");
  }, []);

  const [mode, setMode] = useState<"web" | "native">("web");
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [message, setMessage] = useState<string>("Ready.");
  const [isLoading, setIsLoading] = useState(false);

  const testApi = async () => {
    setIsLoading(true);
    try {
      if (!baseUrl) throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");
      const data = await apiFetch<{ publicKey: string }>(
        "/api/notifications/vapid-public-key"
      );
      setMessage(`API OK. VAPID key length: ${data.publicKey.length}`);
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    } finally {
      setIsLoading(false);
    }
  };

  const openWebTab = (nextTab: TabKey) => {
    setTab(nextTab);
    setMode("web");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Budget App (Mobile)</Text>
        <Text style={styles.subtitle}>{baseUrl ? baseUrl : "Set EXPO_PUBLIC_API_BASE_URL"}</Text>

        <View style={styles.row}>
          <Button title={mode === "web" ? "Web (active)" : "Web"} onPress={() => setMode("web")} />
          <Button title={mode === "native" ? "Native (active)" : "Native"} onPress={() => setMode("native")} />
        </View>
      </View>

      <View style={styles.body}>
        {mode === "web" ? (
          tab === "dashboard" ? (
            <WebScreen baseUrl={baseUrl} path="/dashboard" />
          ) : tab === "expenses" ? (
            <WebScreen baseUrl={baseUrl} path="/admin/expenses" />
          ) : (
            <WebScreen baseUrl={baseUrl} path="/admin/settings" />
          )
        ) : (
          tab === "dashboard" ? (
            <DashboardNativeScreen
             
            />
          ) : (
            <NativePlaceholderScreen
              title={tab === "expenses" ? "Expenses" : "Settings"}
              message={message}
              onTestApi={testApi}
              busy={isLoading}
            />
          )
        )}
      </View>

      <BottomTabs active={tab} onChange={setTab} />

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  body: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
});
