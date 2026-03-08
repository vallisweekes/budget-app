import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsBudgetTab from "@/components/Settings/SettingsBudgetTab";
import SettingsDangerTab from "@/components/Settings/SettingsDangerTab";
import SettingsLocaleTab from "@/components/Settings/SettingsLocaleTab";
import SettingsMoneyTab from "@/components/Settings/SettingsMoneyTab";
import SettingsNotificationsTab from "@/components/Settings/SettingsNotificationsTab";
import SettingsOverviewTab from "@/components/Settings/SettingsOverviewTab";
import SettingsPlansTab from "@/components/Settings/SettingsPlansTab";
import SettingsSubpageHeader from "@/components/Settings/SettingsSubpageHeader";
import { asMoneyText, formatBillFrequency, formatPayFrequency } from "@/lib/helpers/settings";
import {
  getSettingsAppVersionLabel,
  openSettingsExternalUrl,
  SETTINGS_TAB_TITLES,
  SETTINGS_WEBSITE_URL,
} from "@/lib/helpers/settingsOverview";
import { styles } from "./styles";
import { T } from "@/lib/theme";
import type { SettingsMainContentProps } from "@/types/components/settings/SettingsMainContent.types";

export default function SettingsMainContent({ controller, navigation, savingsTileSize, getAddPotLabel, getSavingsTilePalette }: SettingsMainContentProps) {
  const scrollRef = React.useRef<ScrollView | null>(null);

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
        <Pressable onPress={controller.load} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Retry</Text></Pressable>
      </View>
    );
  }

  if (controller.noPlan) {
    return (
      <View style={styles.center}>
        <Ionicons name="wallet-outline" size={44} color={T.textDim} />
        <Text style={styles.noPlanTitle}>Create your first budget plan</Text>
        <Text style={styles.noPlanText}>You don’t have a plan yet. Create one to start budgeting.</Text>
        <Pressable onPress={controller.createPersonalPlan} style={[styles.primaryBtn, controller.saveBusy && styles.disabled]} disabled={controller.saveBusy}>
          <Text style={styles.primaryBtnText}>{controller.saveBusy ? "Creating…" : "Create Plan"}</Text>
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
      {controller.activeTab !== "details" ? (
        <SettingsSubpageHeader
          title={SETTINGS_TAB_TITLES[controller.activeTab]}
          onBack={() => controller.setActiveTab("details")}
        />
      ) : null}
      {controller.activeTab === "details" ? (
        <SettingsOverviewTab
          email={controller.profile?.email ?? "No email set"}
          payDateLabel={controller.settings?.payDate ? `Day ${controller.settings.payDate}` : "Not set"}
          payFrequencyLabel={formatPayFrequency(controller.settings?.payFrequency)}
          currencyLabel={controller.settings?.currency ?? "GBP"}
          notificationsLabel={controller.notifications.dueReminders || controller.notifications.paymentAlerts || controller.notifications.dailyTips ? "On" : "Off"}
          versionLabel={getSettingsAppVersionLabel()}
          onEditProfile={() => controller.setDetailsSheetOpen(true)}
          onOpenBudget={() => controller.setActiveTab("budget")}
          onOpenIncomeSettings={() => {
            const budgetPlanId = controller.settings?.id;
            if (!budgetPlanId) return;
            const now = new Date();
            navigation.navigate("Income" as any, {
              screen: "IncomeMonth",
              params: {
                month: now.getMonth() + 1,
                year: now.getFullYear(),
                budgetPlanId,
                initialMode: "income",
              },
            } as any);
          }}
          onOpenSavings={() => controller.setActiveTab("savings")}
          onOpenPlans={() => controller.setActiveTab("plans")}
          onOpenLocale={() => controller.setActiveTab("locale")}
          onOpenNotifications={() => controller.setActiveTab("notifications")}
          onOpenDanger={() => controller.setActiveTab("danger")}
          onOpenAbout={() => { void openSettingsExternalUrl(SETTINGS_WEBSITE_URL); }} onOpenPrivacy={() => { void openSettingsExternalUrl(`${SETTINGS_WEBSITE_URL}/privacy-policy`); }}
        />
      ) : null}

      {controller.activeTab === "budget" ? (
        <SettingsBudgetTab
          payDate={controller.settings?.payDate}
          horizonYears={controller.currentPlan?.budgetHorizonYears ?? 10}
          payFrequencyLabel={formatPayFrequency(controller.settings?.payFrequency)}
          billFrequencyLabel={formatBillFrequency(controller.settings?.billFrequency)}
          strategyDraft={controller.strategyDraft}
          onOpenField={controller.setBudgetFieldSheet}
          onOpenIncomeSettings={() => {
            const budgetPlanId = controller.settings?.id;
            if (!budgetPlanId) return;
            const now = new Date();
            navigation.navigate("Income" as any, {
              screen: "IncomeMonth",
              params: {
                month: now.getMonth() + 1,
                year: now.getFullYear(),
                budgetPlanId,
                initialMode: "income",
              },
            } as any);
          }}
          onOpenStrategy={() => {
            if (!controller.settings?.id) return;
            navigation.navigate("SettingsStrategy", { budgetPlanId: controller.settings.id, strategy: controller.strategyDraft });
          }}
        />
      ) : null}

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
            if ((controller.settings.country ?? "").toUpperCase() === "GB") return;
            controller.setCountryDraft(controller.detectedCountry);
            void controller.saveCountry(controller.detectedCountry);
          }}
          canUseDetected={Boolean(controller.detectedCountry) && (controller.settings?.country ?? "").toUpperCase() !== "GB"}
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
