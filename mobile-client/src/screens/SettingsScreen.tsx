import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import type { Settings } from "@/lib/apiTypes";

function SettingRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { username, signOut } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let apiBase = "";
  try { apiBase = getApiBaseUrl(); } catch { /* not configured */ }

  const load = useCallback(async () => {
    try {
      setError(null);
      const s = await apiFetch<Settings>("/api/bff/settings");
      setSettings(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f6cf7" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="#455" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4f6cf7" />}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{username?.[0]?.toUpperCase() ?? "?"}</Text>
            </View>
            <View>
              <Text style={styles.profileName}>{username}</Text>
              <Text style={styles.profileSub}>Budget App account</Text>
            </View>
          </View>

          {/* Budget settings */}
          <Section title="Budget">
            <SettingRow label="Strategy" value={settings?.budgetStrategy} />
            <SettingRow label="Monthly allowance" value={settings?.monthlyAllowance ? `${settings.currency ?? "$"}${settings.monthlyAllowance}` : null} />
            <SettingRow label="Pay date" value={settings?.payDate ? `${settings.payDate}th of month` : null} />
          </Section>

          {/* Savings */}
          <Section title="Savings">
            <SettingRow label="Current balance" value={settings?.savingsBalance ? `${settings.currency ?? "$"}${settings.savingsBalance}` : null} />
            <SettingRow label="Monthly contribution" value={settings?.monthlySavingsContribution ? `${settings.currency ?? "$"}${settings.monthlySavingsContribution}` : null} />
            <SettingRow label="Emergency contribution" value={settings?.monthlyEmergencyContribution ? `${settings.currency ?? "$"}${settings.monthlyEmergencyContribution}` : null} />
            <SettingRow label="Investment contribution" value={settings?.monthlyInvestmentContribution ? `${settings.currency ?? "$"}${settings.monthlyInvestmentContribution}` : null} />
          </Section>

          {/* Locale */}
          <Section title="Locale">
            <SettingRow label="Currency" value={settings?.currency} />
            <SettingRow label="Country" value={settings?.country} />
            <SettingRow label="Language" value={settings?.language} />
          </Section>

          {/* App info */}
          <Section title="App">
            <View style={styles.row}>
              <Text style={styles.rowLabel}>API server</Text>
              <Text style={[styles.rowValue, styles.monoText]} numberOfLines={1}>{apiBase || "Not configured"}</Text>
            </View>
          </Section>

          {/* Sign out */}
          <Pressable onPress={signOut} style={styles.signOutBtn}>
            <Ionicons name="log-out-outline" size={18} color="#e25c5c" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#070e1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { padding: 16, paddingBottom: 48 },

  profileCard: {
    backgroundColor: "#111d30",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#4f6cf7",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  profileName: { color: "#fff", fontSize: 17, fontWeight: "700" },
  profileSub: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 },

  section: {
    backgroundColor: "#111d30",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  rowLabel: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
  rowValue: { color: "#fff", fontSize: 14, fontWeight: "600", maxWidth: "55%" },
  monoText: { fontVariant: ["tabular-nums"], fontSize: 11 },

  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(226,92,92,0.1)",
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(226,92,92,0.2)",
  },
  signOutText: { color: "#e25c5c", fontSize: 15, fontWeight: "700" },

  errorText: { color: "#e25c5c", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: "#4f6cf7", borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: "#fff", fontWeight: "700" },
});
