import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";
import { useAuth } from "@/context/AuthContext";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";

const STRATEGY_OPTIONS = [
  { value: "payYourselfFirst", label: "Pay Yourself First", tip: "Prioritise savings and investment before discretionary spending." },
  { value: "zeroBased", label: "Zero-based", tip: "Assign every pound to a category so leftover becomes £0." },
  { value: "fiftyThirtyTwenty", label: "50/30/20", tip: "Split income into needs, wants, and savings/debt reduction." },
] as const;

export default function SettingsStrategyScreen({ navigation, route }: RootStackScreenProps<"SettingsStrategy">) {
  const { budgetPlanId, strategy } = route.params;
  const { signOut } = useAuth();
  const topHeaderOffset = useTopHeaderOffset(8);
  const [draft, setDraft] = useState(strategy ?? "payYourselfFirst");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => STRATEGY_OPTIONS.find((opt) => opt.value === draft), [draft]);

  const save = async () => {
    try {
      setSaving(true);
      await apiFetch("/api/bff/settings", {
        method: "PATCH",
        body: {
          budgetPlanId,
          budgetStrategy: draft,
        },
      });
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Could not save strategy", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.header, { paddingTop: topHeaderOffset }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <View style={styles.headerSpacer} />
        <Pressable onPress={signOut} style={styles.headerLogoutBtn}>
          <Ionicons name="log-out-outline" size={16} color={T.red} />
          <Text style={styles.headerLogoutText}>Logout</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {STRATEGY_OPTIONS.map((option) => {
          const active = draft === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setDraft(option.value)}
              style={[styles.card, active && styles.cardActive]}
            >
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{option.label}</Text>
                {active ? <Ionicons name="checkmark-circle" size={18} color={T.accent} /> : null}
              </View>
              <Text style={styles.cardTip}>{option.tip}</Text>
            </Pressable>
          );
        })}

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Selected tip</Text>
          <Text style={styles.tipText}>{selected?.tip}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save strategy"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { flex: 1 },
  headerLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: `${T.red}66`,
    backgroundColor: `${T.red}18`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerLogoutText: { color: T.red, fontSize: 12, fontWeight: "800" },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120, gap: 10 },
  card: {
    ...cardBase,
    padding: 14,
    marginBottom: 10,
  },
  cardActive: {
    borderColor: T.accent,
    backgroundColor: T.accentFaint,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { color: T.text, fontSize: 15, fontWeight: "800" },
  cardTitleActive: { color: T.accent },
  cardTip: { color: T.textDim, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  tipCard: {
    ...cardElevated,
    padding: 14,
    marginTop: 2,
  },
  tipTitle: { color: T.text, fontSize: 13, fontWeight: "800", marginBottom: 6 },
  tipText: { color: T.textDim, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: `${T.bg}F2`,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  saveBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  saveBtnText: { color: T.onAccent, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.6 },
});
