import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { useTopHeaderOffset } from "@/hooks";
import { T } from "@/lib/theme";
import { useDeleteDebtMutation, useGetDebtSummaryQuery, useGetOnboardingStatusQuery, useUpdateOnboardingProfileMutation } from "@/store/api";

import { styles } from "./style";

export default function SettingsDebtManagementScreen() {
  const topHeaderOffset = useTopHeaderOffset(8);
  const { dashboard, refresh: refreshBootstrap } = useBootstrapData();
  const { refreshProfile } = useAuth();
  const onboardingQuery = useGetOnboardingStatusQuery();
  const debtSummaryQuery = useGetDebtSummaryQuery();
  const [updateOnboardingProfile, { isLoading: saving }] = useUpdateOnboardingProfileMutation();
  const [deleteDebt] = useDeleteDebtMutation();
  const [isApplying, setIsApplying] = useState(false);
  const [confirmSheetVisible, setConfirmSheetVisible] = useState(false);

  const remoteProfile = onboardingQuery.data?.profile ?? null;
  const remoteEnabled = Boolean(remoteProfile?.hasDebtsToManage);
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean>(remoteEnabled);

  useEffect(() => {
    setOptimisticEnabled(remoteEnabled);
  }, [remoteEnabled]);

  const debtIds = useMemo(() => {
    const summaryIds = (debtSummaryQuery.data?.debts ?? []).map((debt) => debt.id).filter(Boolean);
    if (summaryIds.length > 0) return Array.from(new Set(summaryIds));
    const dashboardIds = (dashboard?.debts ?? []).map((debt) => debt.id).filter(Boolean);
    return Array.from(new Set(dashboardIds));
  }, [dashboard?.debts, debtSummaryQuery.data?.debts]);

  const hasAnyDebtSetup = debtIds.length > 0;
  const switchValue = optimisticEnabled;
  const isBusy = saving || isApplying;
  const requiresDisableConfirmation = switchValue && hasAnyDebtSetup;

  const applyDebtManagement = useCallback(async (nextEnabled: boolean, clearDebtData: boolean) => {
    if (isBusy || nextEnabled === switchValue) return;
    const previous = switchValue;
    setOptimisticEnabled(nextEnabled);
    setIsApplying(true);

    try {
      if (clearDebtData && debtIds.length > 0) {
        const results = await Promise.allSettled(debtIds.map((debtId) => deleteDebt({ id: debtId }).unwrap()));
        const failedCount = results.filter((result) => result.status === "rejected").length;
        if (failedCount > 0) {
          throw new Error(`Couldn't remove ${failedCount} debt ${failedCount === 1 ? "record" : "records"}.`);
        }
      }

      await updateOnboardingProfile({
        hasDebtsToManage: nextEnabled,
        debtAmount: nextEnabled ? remoteProfile?.debtAmount ?? null : null,
        debtNotes: nextEnabled ? remoteProfile?.debtNotes ?? null : null,
      }).unwrap();

      await Promise.allSettled([
        onboardingQuery.refetch(),
        refreshProfile(),
        refreshBootstrap({ force: true }),
      ]);
    } catch (err: unknown) {
      setOptimisticEnabled(previous);
      Alert.alert("Could not update debt management", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsApplying(false);
    }
  }, [debtIds, deleteDebt, isBusy, onboardingQuery, refreshBootstrap, refreshProfile, remoteProfile?.debtAmount, remoteProfile?.debtNotes, switchValue, updateOnboardingProfile]);

  const handleToggle = useCallback((nextEnabled: boolean) => {
    if (isBusy || nextEnabled === switchValue) return;

    if (!nextEnabled && hasAnyDebtSetup) {
      setConfirmSheetVisible(true);
      return;
    }

    void applyDebtManagement(nextEnabled, false);
  }, [applyDebtManagement, hasAnyDebtSetup, isBusy, switchValue]);

  const openDisableConfirmSheet = useCallback(() => {
    if (isBusy || !requiresDisableConfirmation) return;
    setConfirmSheetVisible(true);
  }, [isBusy, requiresDisableConfirmation]);

  const closeDisableConfirmSheet = useCallback(() => {
    if (isBusy) return;
    setConfirmSheetVisible(false);
  }, [isBusy]);

  const confirmDisableFromSheet = useCallback(() => {
    setConfirmSheetVisible(false);
    void applyDebtManagement(false, true);
  }, [applyDebtManagement]);

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
          <Text style={styles.toggleTitle}>Debt management</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchTitle}>Show Debts tab</Text>
              <Text style={styles.switchHint}>
                {switchValue
                  ? hasAnyDebtSetup
                    ? "Turn off to remove debt management data and hide the Debts tab."
                    : "Turn off to hide the Debts tab."
                  : "Turn on to show the Debts tab and start tracking debt."}
              </Text>
            </View>
            {requiresDisableConfirmation && !isBusy ? (
              <Pressable
                style={styles.switchPressTarget}
                onPress={openDisableConfirmSheet}
                accessibilityRole="button"
                accessibilityLabel="Review debt management removal"
              >
                <View pointerEvents="none">
                  <Switch
                    value={switchValue}
                    onValueChange={() => {}}
                    trackColor={{ false: `${T.border}`, true: `${T.accentFaint}` }}
                    thumbColor={switchValue ? T.accent : T.card}
                  />
                </View>
              </Pressable>
            ) : (
              <Switch
                value={switchValue}
                onValueChange={handleToggle}
                disabled={isBusy}
                trackColor={{ false: `${T.border}`, true: `${T.accentFaint}` }}
                thumbColor={switchValue ? T.accent : T.card}
              />
            )}
          </View>
          <Text style={styles.toggleHint}>
            {isBusy
              ? "Updating debt visibility..."
              : hasAnyDebtSetup
              ? "Turning this off opens a confirmation sheet before debt records are removed."
              : "If turned on, the Debts tab appears and you can add debt data later."}
          </Text>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={confirmSheetVisible}
        onRequestClose={closeDisableConfirmSheet}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={closeDisableConfirmSheet} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <View style={styles.sheetWarningIconWrap}>
                <Ionicons name="warning-outline" size={16} color={T.orange} />
              </View>
              <Text style={styles.sheetTitle}>Turn off debt management?</Text>
            </View>
            <Text style={styles.sheetDescription}>
              If you continue, you will lose all debt management data for this plan. This action cannot be undone.
            </Text>
            <View style={styles.sheetActions}>
              <Pressable style={styles.sheetCancelBtn} onPress={closeDisableConfirmSheet} disabled={isBusy}>
                <Text style={styles.sheetCancelBtnText}>Keep On</Text>
              </Pressable>
              <Pressable style={[styles.sheetDangerBtn, isBusy && styles.sheetBtnDisabled]} onPress={confirmDisableFromSheet} disabled={isBusy}>
                <Text style={styles.sheetDangerBtnText}>{isBusy ? "Turning Off..." : "Turn Off"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}