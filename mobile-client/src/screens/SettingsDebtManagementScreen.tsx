import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";
import type { RootStackScreenProps } from "@/navigation/types";
import { useGetOnboardingStatusQuery, useUpdateOnboardingProfileMutation } from "@/store/api";

export default function SettingsDebtManagementScreen({ navigation }: RootStackScreenProps<"SettingsDebtManagement">) {
  const topHeaderOffset = useTopHeaderOffset(8);
  const { dashboard } = useBootstrapData();
  const onboardingQuery = useGetOnboardingStatusQuery();
  const [updateOnboardingProfile, { isLoading: saving }] = useUpdateOnboardingProfileMutation();

  const remoteProfile = onboardingQuery.data?.profile ?? null;
  const [draftEnabled, setDraftEnabled] = useState<boolean>(Boolean(remoteProfile?.hasDebtsToManage));

  useEffect(() => {
    setDraftEnabled(Boolean(remoteProfile?.hasDebtsToManage));
  }, [remoteProfile?.hasDebtsToManage]);

  const hasActualDebts = useMemo(
    () => (dashboard?.debts ?? []).some((debt) => Number(debt?.currentBalance ?? 0) > 0),
    [dashboard?.debts]
  );
  const effectiveEnabled = hasActualDebts || draftEnabled;
  const isDirty = draftEnabled !== Boolean(remoteProfile?.hasDebtsToManage);

  const save = async () => {
    try {
      await updateOnboardingProfile({
        hasDebtsToManage: draftEnabled,
        debtAmount: draftEnabled ? remoteProfile?.debtAmount ?? null : null,
        debtNotes: draftEnabled ? remoteProfile?.debtNotes ?? null : null,
      }).unwrap();
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Could not save debt management", err instanceof Error ? err.message : "Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.header, { paddingTop: topHeaderOffset }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Debt management</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Visibility</Text>
          <Text style={styles.heroTitle}>Show the Debts tab only when debt tracking is needed.</Text>
          <Text style={styles.heroText}>
            Turn this on if you want to manage cards or debts. If it stays off and you have no debts, the Debts tab stays hidden.
          </Text>
        </View>

        <View style={styles.stateCard}>
          <Text style={styles.stateLabel}>Current status</Text>
          <Text style={[styles.stateValue, effectiveEnabled ? styles.stateValueOn : styles.stateValueOff]}>
            {effectiveEnabled ? "On" : "Off"}
          </Text>
          <Text style={styles.stateHint}>
            {hasActualDebts
              ? "Debt management stays on because this plan already has debt balances."
              : effectiveEnabled
                ? "The Debts tab will be visible so the user can add and manage cards or debts."
                : "The Debts tab will stay hidden until debt management is turned on."}
          </Text>
        </View>

        <View style={styles.toggleCard}>
          <Text style={styles.toggleTitle}>Debt management</Text>
          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setDraftEnabled(true)}
              style={[styles.toggle, draftEnabled && styles.toggleActive]}
              disabled={saving}
            >
              <Text style={[styles.toggleText, draftEnabled && styles.toggleTextActive]}>On</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (hasActualDebts) return;
                setDraftEnabled(false);
              }}
              style={[styles.toggle, !draftEnabled && styles.toggleActive, hasActualDebts && styles.toggleDisabled]}
              disabled={saving || hasActualDebts}
            >
              <Text style={[styles.toggleText, !draftEnabled && styles.toggleTextActive, hasActualDebts && styles.toggleTextDisabled]}>Off</Text>
            </Pressable>
          </View>
          <Text style={styles.toggleHint}>
            {hasActualDebts
              ? "Turn this off after the debts are cleared if you want the Debts tab hidden again."
              : "If turned on, the Debts tab appears and the user can add debts later."}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.saveBtn, (!isDirty || saving) && styles.disabled]} onPress={save} disabled={!isDirty || saving}>
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: T.text, fontSize: 18, fontWeight: "800" },
  headerSpacer: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 12 },
  heroCard: { ...cardElevated, padding: 18, gap: 8 },
  heroEyebrow: { color: T.accent, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.3 },
  heroTitle: { color: T.text, fontSize: 20, fontWeight: "900", lineHeight: 26 },
  heroText: { color: T.textDim, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  stateCard: { ...cardBase, padding: 16, gap: 6 },
  stateLabel: { color: T.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  stateValue: { fontSize: 20, fontWeight: "900" },
  stateValueOn: { color: T.green },
  stateValueOff: { color: T.textMuted },
  stateHint: { color: T.textDim, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  toggleCard: { ...cardBase, padding: 16, gap: 12 },
  toggleTitle: { color: T.text, fontSize: 15, fontWeight: "800" },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggle: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: T.accent,
    borderColor: T.accent,
  },
  toggleDisabled: {
    opacity: 0.45,
  },
  toggleText: { color: T.textDim, fontSize: 15, fontWeight: "800" },
  toggleTextActive: { color: T.onAccent },
  toggleTextDisabled: { color: T.textMuted },
  toggleHint: { color: T.textDim, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  footer: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: `${T.bg}F2`,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: T.card,
  },
  cancelBtnText: { color: T.textMuted, fontSize: 14, fontWeight: "800" },
  saveBtn: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: T.accent,
  },
  saveBtnText: { color: T.onAccent, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.6 },
});