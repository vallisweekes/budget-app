import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { useTopHeaderOffset } from "@/hooks";
import { T } from "@/lib/theme";
import type { RootStackScreenProps } from "@/navigation/types";
import { useGetOnboardingStatusQuery, useUpdateOnboardingProfileMutation } from "@/store/api";

import { styles } from "./style";

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