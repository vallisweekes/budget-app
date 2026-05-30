import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import SettingsBudgetTab from "@/components/Settings/SettingsBudgetTab";
import SettingsDangerTab from "@/components/Settings/SettingsDangerTab";
import SettingsLocaleTab from "@/components/Settings/SettingsLocaleTab";
import SettingsMoneyTab from "@/components/Settings/SettingsMoneyTab";
import SettingsNotificationsTab from "@/components/Settings/SettingsNotificationsTab";
import SettingsOverviewTab from "@/components/Settings/SettingsOverviewTab";
import SettingsPlansTab from "@/components/Settings/SettingsPlansTab";
import SettingsSubscriptionTab from "@/components/Settings/SettingsSubscriptionTab";
import SettingsSubpageHeader from "@/components/Settings/SettingsSubpageHeader";
import { useAppTranslation } from "@/hooks";
import { normalizeSupportedLanguage, resolveDefaultLanguageForCountry } from "@/lib/constants";
import { hasPositiveDebtBalance, isDebtManagementEnabled } from "@/lib/helpers/debtManagement";
import { asMoneyText } from "@/lib/helpers/settings";
import {
  getSettingsTabTitle,
  getSettingsAppVersionLabel,
  openSettingsExternalUrl,
  SETTINGS_WEBSITE_URL,
} from "@/lib/helpers/settingsOverview";
import { styles } from "./styles";
import { T } from "@/lib/theme";
import { useGetDebtSummaryQuery } from "@/store/api";
import type { AppTranslationKey } from "@/lib/i18n";
import type { SettingsMainContentProps } from "@/types/components/settings/SettingsMainContent.types";

function formatSettingsPayFrequency(value: unknown, t: (key: AppTranslationKey, params?: Record<string, string | number>) => string): string {
  if (value === "weekly") return t("settings.payFrequency.weekly");
  if (value === "every_2_weeks") return t("settings.payFrequency.every2Weeks");
  if (value === "every_4_weeks") return t("settings.payFrequency.every4Weeks");
  return t("settings.payFrequency.monthly");
}

function getVerificationLabel(
  profile: SettingsMainContentProps["controller"]["profile"],
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string,
): string {
  if (!profile) return t("common.unavailable");
  if (profile.emailVerificationStatus === "verified") return t("settings.status.verified");
  if (profile.emailVerificationStatus === "pending") return t("settings.status.pending");
  if (profile.emailVerificationStatus === "missing_email") return t("settings.status.addEmail");
  return t("settings.status.notRequired");
}

function getVerificationColor(profile: SettingsMainContentProps["controller"]["profile"]): string | undefined {
  if (!profile) return undefined;
  if (profile.emailVerificationStatus === "verified") return T.green;
  if (profile.emailVerificationStatus === "pending") return T.orange;
  if (profile.emailVerificationStatus === "missing_email") return T.red;
  return undefined;
}

export default function SettingsMainContent({ controller, navigation, savingsTileSize, getAddPotLabel, getSavingsTilePalette }: SettingsMainContentProps) {
  const scrollRef = React.useRef<ScrollView | null>(null);
  const router = useRouter();
  const { dashboard } = useBootstrapData();
  const { t } = useAppTranslation(controller.settings?.language);
  const debtSummaryQuery = useGetDebtSummaryQuery(undefined, { refetchOnMountOrArgChange: true });
  const openIncomeSettings = React.useCallback(() => {
    router.push("/settings-income-settings");
  }, [router]);
  const openDebtManagement = React.useCallback(() => {
    router.push("/settings-debt-management");
  }, [router]);
  const hasDashboardDebts = React.useMemo(() => {
    if (debtSummaryQuery.isSuccess) {
      return (debtSummaryQuery.data?.activeCount ?? 0) > 0;
    }

    return hasPositiveDebtBalance(dashboard?.debts);
  }, [dashboard?.debts, debtSummaryQuery.data?.activeCount, debtSummaryQuery.isSuccess]);
  const debtManagementEnabled = isDebtManagementEnabled({
    hasActualDebts: hasDashboardDebts,
    hasConfiguredDebts: controller.hasAnyDebts,
    onboardingHasDebtsToManage: controller.profile?.onboarding?.profile?.hasDebtsToManage,
    profileHasDebtsToManage: controller.profile?.onboarding?.profile?.hasDebtsToManage,
  });

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [controller.activeTab]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return unsubscribe;
  }, [navigation]);

  if (controller.loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={T.accent} /></View>;
  }

  if (controller.error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={40} color={T.textDim} />
        <Text style={styles.errorText}>{controller.error}</Text>
        <Pressable onPress={controller.load} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{t("settings.loadingRetry")}</Text></Pressable>
      </View>
    );
  }

  if (controller.noPlan) {
    return (
      <View style={styles.center}>
        <Ionicons name="wallet-outline" size={44} color={T.textDim} />
        <Text style={styles.noPlanTitle}>{t("settings.noPlan.title")}</Text>
        <Text style={styles.noPlanText}>{t("settings.noPlan.message")}</Text>
        <Pressable onPress={controller.createPersonalPlan} style={[styles.primaryBtn, controller.saveBusy && styles.disabled]} disabled={controller.saveBusy}>
          <Text style={styles.primaryBtnText}>{controller.saveBusy ? t("settings.noPlan.creating") : t("settings.noPlan.create")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      refreshControl={<RefreshControl refreshing={controller.refreshing} onRefresh={() => { controller.setRefreshing(true); controller.load(); }} tintColor={T.accent} />}
      contentContainerStyle={[styles.scroll, { paddingTop: controller.isMoneyTab ? controller.moneyScrollTopPadding : controller.topHeaderOffset }]}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      showsVerticalScrollIndicator={false}
    >
      {controller.activeTab !== "details" && controller.activeTab !== "subscription" && controller.activeTab !== "budget" && controller.activeTab !== "savings" && controller.activeTab !== "plans" && controller.activeTab !== "locale" && controller.activeTab !== "notifications"
        ? <SettingsSubpageHeader title={getSettingsTabTitle(controller.activeTab, t)} onBack={() => controller.setActiveTab("details")} />
        : null}
      {controller.activeTab === "details" ? (
        <SettingsOverviewTab
          profileLabel={controller.profile?.username ?? controller.authUsername ?? controller.profile?.email ?? t("common.notSet")}
          emailVerificationLabel={getVerificationLabel(controller.profile, t)}
          emailVerificationColor={getVerificationColor(controller.profile)}
          subscriptionLabel={controller.subscription?.current.planLabel ?? t("common.free")}
          payDateLabel={controller.settings?.payDate ? t("settings.status.day", { day: controller.settings.payDate }) : t("common.notSet")}
          payFrequencyLabel={formatSettingsPayFrequency(controller.settings?.payFrequency, t)}
          debtManagementLabel={debtManagementEnabled ? t("common.on") : t("common.off")}
          currencyLabel={controller.settings?.currency ?? "GBP"}
          notificationsLabel={controller.notifications.dueReminders || controller.notifications.paymentAlerts || controller.notifications.dailyTips ? t("common.on") : t("common.off")}
          versionLabel={getSettingsAppVersionLabel()}
          onEditProfile={() => router.push({
            pathname: "/settings-profile-details",
            params: {
              username: controller.profile?.username ?? controller.authUsername ?? "",
              email: controller.profile?.email ?? "",
              emailVerificationStatus: controller.profile?.emailVerificationStatus ?? "not_required",
              emailVerificationDeadlineAt: controller.profile?.emailVerificationDeadlineAt ?? null,
            },
          })}
          onOpenEmailVerification={() => router.push({
            pathname: "/settings-profile-details",
            params: {
              username: controller.profile?.username ?? controller.authUsername ?? "",
              email: controller.profile?.email ?? "",
              emailVerificationStatus: controller.profile?.emailVerificationStatus ?? "not_required",
              emailVerificationDeadlineAt: controller.profile?.emailVerificationDeadlineAt ?? null,
            },
          })}
          onOpenSubscription={() => controller.setActiveTab("subscription")}
          onOpenBudget={() => controller.setActiveTab("budget")}
          onOpenIncomeSettings={openIncomeSettings}
          onOpenDebtManagement={openDebtManagement}
          onOpenSavings={() => controller.setActiveTab("savings")}
          onOpenPlans={() => controller.setActiveTab("plans")}
          onOpenLocale={() => controller.setActiveTab("locale")}
          onOpenNotifications={() => controller.setActiveTab("notifications")}
          onOpenDanger={() => controller.setActiveTab("danger")}
          onOpenAbout={() => { void openSettingsExternalUrl(SETTINGS_WEBSITE_URL); }}
          onOpenPrivacy={() => router.push("/privacy-policy")}
        />
      ) : null}

      {controller.activeTab === "budget" ? (
        <SettingsBudgetTab
          payDate={controller.settings?.payDate}
          horizonYears={controller.currentPlan?.budgetHorizonYears ?? 10}
          payFrequencyLabel={formatSettingsPayFrequency(controller.settings?.payFrequency, t)}
          strategyDraft={controller.strategyDraft}
          onOpenField={controller.setBudgetFieldSheet}
          onOpenIncomeSettings={openIncomeSettings}
          onOpenStrategy={() => {
            if (!controller.settings?.id) return;
            router.push({
              pathname: "/settings-strategy",
              params: {
                budgetPlanId: controller.settings.id,
                strategy: controller.strategyDraft ?? "",
              },
            });
          }}
        />
      ) : null}

      {controller.activeTab === "subscription" ? <SettingsSubscriptionTab subscription={controller.subscription} loading={controller.subscriptionLoading} error={controller.subscriptionError} onRetry={() => { void controller.loadSubscription(true); }} /> : null}

      {controller.activeTab === "savings" ? (
        <SettingsMoneyTab
          mode={controller.moneyViewMode}
          toggleTranslateX={controller.moneyToggleTranslateX}
          tileSize={savingsTileSize}
          currency={controller.cur}
          savingsCards={controller.savingsCards}
          savingsPotsByField={controller.savingsPotsByField}
          creditCardGroups={controller.creditCardGroups}
          storeCardGroups={controller.storeCardGroups}
          asMoneyText={asMoneyText}
          getAddPotLabel={getAddPotLabel}
          getSavingsTilePalette={getSavingsTilePalette}
          onChangeMode={controller.setMoneyViewMode}
          onOpenSavingsEditor={controller.openSavingsEditor}
          onOpenSavingsField={controller.openSavingsField}
          onAddDebt={() => controller.setAddDebtSheetOpen(true)}
          onOpenDebtEditor={controller.openDebtEditor}
        />
      ) : null}

      {controller.activeTab === "locale" ? (
        <SettingsLocaleTab
          country={(controller.settings?.country ?? "").toUpperCase()}
          language={controller.settings?.language}
          currency={controller.settings?.currency}
          detectedCountry={controller.detectedCountry}
          onEdit={() => controller.setLocaleSheetOpen(true)}
          onUseDetected={() => {
            if (!controller.detectedCountry || !controller.settings?.id) return;
            if ((controller.settings.country ?? "").toUpperCase() === controller.detectedCountry) return;
            const currentCountry = (controller.settings.country ?? "").toUpperCase();
            const currentDefaultLanguage = resolveDefaultLanguageForCountry(currentCountry);
            const currentLanguage = normalizeSupportedLanguage(controller.settings?.language ?? controller.languageDraft, currentDefaultLanguage);
            const nextLanguage = currentLanguage === currentDefaultLanguage
              ? resolveDefaultLanguageForCountry(controller.detectedCountry)
              : currentLanguage;
            controller.setCountryDraft(controller.detectedCountry);
            void controller.saveLocale(controller.detectedCountry, nextLanguage);
          }}
          canUseDetected={Boolean(controller.detectedCountry) && (controller.settings?.country ?? "").toUpperCase() !== controller.detectedCountry}
        />
      ) : null}

      {controller.activeTab === "plans" ? (
        <SettingsPlansTab
          plans={controller.plans}
          currentPlanId={controller.currentPlanId}
          switchingPlanId={controller.switchingPlanId}
          deletingPlanId={controller.deletingPlanId}
          onSwitchPlan={controller.switchPlan}
          onDeletePlan={controller.setPlanDeleteTarget}
          onCreateHoliday={() => {
            controller.setNewPlanType("holiday");
            controller.setCreatePlanSheetOpen(true);
          }}
          onCreateCarnival={() => {
            controller.setNewPlanType("carnival");
            controller.setCreatePlanSheetOpen(true);
          }}
        />
      ) : null}

      {controller.activeTab === "notifications" ? (
        <SettingsNotificationsTab
          notifications={controller.notifications}
          inbox={controller.notificationInbox}
          formatReceivedAt={controller.formatNotificationReceivedAt}
          onSaveNotifications={(next) => { void controller.saveNotifications(next); }}
          onMarkRead={(id) => { void controller.markNotificationInboxItemRead(id); }}
          onDelete={(id) => { void controller.deleteNotificationInboxItem(id); }}
        />
      ) : null}
      {controller.activeTab === "danger" ? <SettingsDangerTab onResetData={controller.resetData} resettingData={controller.resettingData} onSignOut={controller.signOut} /> : null}
    </ScrollView>
  );
}
