import React from "react";
import { RefreshControl, ScrollView } from "react-native";

import SettingsBudgetTab from "@/components/Settings/SettingsBudgetTab";
import SettingsDangerTab from "@/components/Settings/SettingsDangerTab";
import SettingsLocaleTab from "@/components/Settings/SettingsLocaleTab";
import SettingsMoneyTab from "@/components/Settings/SettingsMoneyTab";
import SettingsNotificationsTab from "@/components/Settings/SettingsNotificationsTab";
import SettingsOverviewTab from "@/components/Settings/SettingsOverviewTab";
import SettingsPersonalTab from "@/components/Settings/SettingsPersonalTab";
import SettingsPreferencesTab from "@/components/Settings/SettingsPreferencesTab";
import SettingsPlansTab from "@/components/Settings/SettingsPlansTab";
import SettingsSubscriptionTab from "@/components/Settings/SettingsSubscriptionTab";
import SettingsSubpageHeader from "@/components/Settings/SettingsSubpageHeader";
import SettingsMainState from "@/components/Settings/SettingsMainContent/SettingsMainState";
import { useSettingsMainContentViewModel } from "@/hooks";
import {
  formatSettingsPayFrequency,
  getVerificationColor,
  getVerificationLabel,
  shouldShowSettingsSubpageHeader,
} from "@/lib/helpers/settingsMainContent";
import { asMoneyText } from "@/lib/helpers/settings";
import {
  getSettingsTabTitle,
  getSettingsAppVersionLabel,
  openSettingsExternalUrl,
  SETTINGS_WEBSITE_URL,
} from "@/lib/helpers/settingsOverview";
import { styles } from "./styles";
import { T } from "@/lib/theme";
import type { SettingsMainContentProps } from "@/types/components/settings/SettingsMainContent.types";

export default function SettingsMainContent({ controller, navigation, savingsTileSize, getAddPotLabel, getSavingsTilePalette }: SettingsMainContentProps) {
  const {
    debtManagementEnabled,
    handleRefresh,
    handleUseDetectedCountry,
    openDebtManagement,
    openIncomeSettings,
    openProfileDetails,
    router,
    scrollRef,
    t,
  } = useSettingsMainContentViewModel({ controller, navigation });
  const showSubpageHeader = shouldShowSettingsSubpageHeader(controller.activeTab);
  const subpageTitle = showSubpageHeader
    ? getSettingsTabTitle(controller.activeTab as Exclude<typeof controller.activeTab, "details">, t)
    : "";

  if (controller.loading || controller.error || controller.noPlan) {
    return (
      <SettingsMainState
        mode={controller.loading ? "loading" : controller.error ? "error" : "noPlan"}
        errorMessage={controller.error || undefined}
        retryButtonLabel={t("settings.loadingRetry")}
        noPlanTitle={t("settings.noPlan.title")}
        noPlanMessage={t("settings.noPlan.message")}
        createButtonLabel={controller.saveBusy ? t("settings.noPlan.creating") : t("settings.noPlan.create")}
        createDisabled={controller.saveBusy}
        onRetry={controller.load}
        onCreatePlan={controller.createPersonalPlan}
      />
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      refreshControl={<RefreshControl refreshing={controller.refreshing} onRefresh={handleRefresh} tintColor={T.accent} />}
      contentContainerStyle={[styles.scroll, { paddingTop: controller.isMoneyTab ? controller.moneyScrollTopPadding : controller.topHeaderOffset }]}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      showsVerticalScrollIndicator={false}
    >
      {showSubpageHeader
        ? <SettingsSubpageHeader title={subpageTitle} onBack={() => controller.setActiveTab("details")} />
        : null}
      {controller.activeTab === "details" ? (
        <SettingsOverviewTab
          profileName={controller.profile?.username ?? controller.authUsername ?? ""}
          avatarUrl={controller.profile?.avatarUrl ?? null}
          onPressAvatar={openProfileDetails}
          onOpenPersonal={() => controller.setActiveTab("personal")}
          onOpenBudget={() => controller.setActiveTab("budget")}
          onOpenSavings={() => controller.setActiveTab("savings")}
          onOpenPreferences={() => controller.setActiveTab("preferences")}
          onSignOut={controller.signOut}
        />
      ) : null}
      {controller.activeTab === "personal" ? (
        <SettingsPersonalTab
          profileLabel={controller.profile?.username ?? controller.authUsername ?? controller.profile?.email ?? t("common.notSet")}
          emailVerificationLabel={getVerificationLabel(controller.profile, t)}
          emailVerificationColor={getVerificationColor(controller.profile)}
          subscriptionLabel={controller.subscription?.current.planLabel ?? t("common.free")}
          onEditProfile={openProfileDetails}
          onOpenEmailVerification={openProfileDetails}
          onOpenSubscription={() => controller.setActiveTab("subscription")}
        />
      ) : null}
      {controller.activeTab === "budget" ? (
        <SettingsBudgetTab
          payDate={controller.settings?.payDate}
          horizonYears={controller.currentPlan?.budgetHorizonYears ?? 10}
          payFrequencyLabel={formatSettingsPayFrequency(controller.settings?.payFrequency, t)}
          debtManagementLabel={debtManagementEnabled ? t("common.on") : t("common.off")}
          strategyDraft={controller.strategyDraft}
          onOpenField={controller.setBudgetFieldSheet}
          onOpenIncomeSettings={openIncomeSettings}
          onOpenDebtManagement={openDebtManagement}
          onOpenPlans={() => controller.setActiveTab("plans")}
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
          onUseDetected={handleUseDetectedCountry}
          canUseDetected={Boolean(controller.detectedCountry) && (controller.settings?.country ?? "").toUpperCase() !== controller.detectedCountry}
        />
      ) : null}
      {controller.activeTab === "preferences" ? (
        <SettingsPreferencesTab
          currencyLabel={controller.settings?.currency ?? "GBP"}
          notificationsLabel={controller.notifications.dueReminders || controller.notifications.paymentAlerts || controller.notifications.dailyTips ? t("common.on") : t("common.off")}
          versionLabel={getSettingsAppVersionLabel()}
          onOpenLocale={() => controller.setActiveTab("locale")}
          onOpenNotifications={() => controller.setActiveTab("notifications")}
          onOpenAbout={() => { void openSettingsExternalUrl(SETTINGS_WEBSITE_URL); }}
          onOpenPrivacy={() => router.push("/privacy-policy")}
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
