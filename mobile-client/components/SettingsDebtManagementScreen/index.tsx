import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { useTopHeaderOffset } from "@/hooks";
import { T } from "@/lib/theme";
import { useGetOnboardingStatusQuery, useUpdateOnboardingProfileMutation } from "@/store/api";

import { styles } from "./style";

export default function SettingsDebtManagementScreen() {
  const topHeaderOffset = useTopHeaderOffset(8);
  const { dashboard, refresh: refreshBootstrap } = useBootstrapData();
  const { refreshProfile } = useAuth();
  const onboardingQuery = useGetOnboardingStatusQuery();
  const [updateOnboardingProfile, { isLoading: saving }] = useUpdateOnboardingProfileMutation();

  const remoteProfile = onboardingQuery.data?.profile ?? null;
  const remoteEnabled = Boolean(remoteProfile?.hasDebtsToManage);
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean>(remoteEnabled);

  useEffect(() => {
    setOptimisticEnabled(remoteEnabled);
  }, [remoteEnabled]);

  const hasActualDebts = useMemo(
    () => (dashboard?.debts ?? []).some((debt) => Number(debt?.currentBalance ?? 0) > 0),
    [dashboard?.debts]
  );

  useEffect(() => {
    if (!hasActualDebts || optimisticEnabled) return;
    setOptimisticEnabled(true);
  }, [hasActualDebts, optimisticEnabled]);

  const switchValue = hasActualDebts ? true : optimisticEnabled;

  const handleToggle = useCallback(async (nextEnabled: boolean) => {
    if (saving || hasActualDebts || nextEnabled === switchValue) return;
    const previous = switchValue;
    setOptimisticEnabled(nextEnabled);

    try {
      await updateOnboardingProfile({
        hasDebtsToManage: nextEnabled,
        debtAmount: nextEnabled ? remoteProfile?.debtAmount ?? null : null,
        debtNotes: nextEnabled ? remoteProfile?.debtNotes ?? null : null,
      }).unwrap();

      await Promise.allSettled([
        refreshProfile(),
        refreshBootstrap({ force: true }),
      ]);
    } catch (err: unknown) {
      setOptimisticEnabled(previous);
      Alert.alert("Could not update debt management", err instanceof Error ? err.message : "Please try again.");
    }
  }, [hasActualDebts, refreshBootstrap, refreshProfile, remoteProfile?.debtAmount, remoteProfile?.debtNotes, saving, switchValue, updateOnboardingProfile]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topHeaderOffset }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View pointerEvents="none" style={[styles.cardGlow, styles.heroGlowPrimary]} />
          <View pointerEvents="none" style={[styles.cardGlow, styles.heroGlowSecondary]} />
          <View style={styles.heroBadge}>
            <Ionicons name="eye-outline" size={12} color={T.accent} />
            <Text style={styles.heroBadgeText}>Visibility</Text>
          </View>
          <Text style={styles.heroTitle}>Show the Debts tab only when debt tracking is needed.</Text>
          <Text style={styles.heroText}>
            Turn this on if you want to manage cards or debts. If it stays off and you have no debts, the Debts tab stays hidden.
          </Text>
        </View>

        <View style={styles.toggleCard}>
          <View pointerEvents="none" style={[styles.cardGlow, styles.toggleGlowPrimary]} />
          <View pointerEvents="none" style={[styles.cardGlow, styles.toggleGlowSecondary]} />
          <View style={styles.toggleTitleRow}>
            <Text style={styles.toggleTitle}>Debt management</Text>
            {hasActualDebts ? (
              <View style={styles.lockedChip}>
                <Ionicons name="lock-closed" size={11} color={T.orange} />
                <Text style={styles.lockedChipText}>Required</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchTitle}>Show Debts tab</Text>
              <Text style={styles.switchHint}>
                {hasActualDebts
                  ? "Debt balances are currently detected, so this remains on."
                  : "Turn off to hide the Debts tab until debt tracking is needed again."}
              </Text>
            </View>
            <Switch
              value={switchValue}
              onValueChange={handleToggle}
              disabled={saving || hasActualDebts}
              trackColor={{ false: `${T.border}`, true: `${T.accentFaint}` }}
              thumbColor={switchValue ? T.accent : T.card}
            />
          </View>
          <Text style={styles.toggleHint}>
            {saving
              ? "Updating debt visibility..."
              : hasActualDebts
              ? "Turn this off after the debts are cleared if you want the Debts tab hidden again."
              : "If turned on, the Debts tab appears and the user can add debts later."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}