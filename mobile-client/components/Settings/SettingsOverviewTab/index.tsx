import React from "react";

import { useAppTranslation } from "@/hooks";
import SettingsLinkRow from "@/components/Settings/SettingsLinkRow";
import SettingsSection from "@/components/Settings/SettingsSection";

import type { SettingsOverviewTabProps } from "@/types/components/settings/SettingsOverviewTab.types";

export default function SettingsOverviewTab({
  profileLabel,
  emailVerificationLabel,
  emailVerificationColor,
  subscriptionLabel,
  payDateLabel,
  payFrequencyLabel,
  debtManagementLabel,
  currencyLabel,
  notificationsLabel,
  versionLabel,
  onEditProfile,
  onOpenEmailVerification,
  onOpenSubscription,
  onOpenBudget,
  onOpenIncomeSettings,
  onOpenDebtManagement,
  onOpenSavings,
  onOpenPlans,
  onOpenLocale,
  onOpenNotifications,
  onOpenDanger,
  onOpenAbout,
  onOpenPrivacy,
}: SettingsOverviewTabProps) {
  const { t } = useAppTranslation();

  return (
    <>
      <SettingsSection title={t("settings.overview.account")}>
        <SettingsLinkRow label={t("settings.overview.profileDetails")} value={profileLabel} onPress={onEditProfile} />
        <SettingsLinkRow label={t("settings.overview.emailVerification")} value={emailVerificationLabel} valueColor={emailVerificationColor} onPress={onOpenEmailVerification} />
        <SettingsLinkRow label={t("settings.overview.subscription")} value={subscriptionLabel} onPress={onOpenSubscription} />
      </SettingsSection>

      <SettingsSection title={t("settings.overview.budgeting")}>
        <SettingsLinkRow label={t("settings.overview.budgetSetup")} value={payDateLabel} onPress={onOpenBudget} />
        <SettingsLinkRow label={t("settings.overview.paySchedule")} value={payFrequencyLabel} onPress={onOpenBudget} />
        <SettingsLinkRow label={t("settings.overview.incomeSettings")} onPress={onOpenIncomeSettings} />
        <SettingsLinkRow label={t("settings.overview.debtManagement")} value={debtManagementLabel} onPress={onOpenDebtManagement} />
        <SettingsLinkRow label={t("settings.overview.savingsAndCards")} onPress={onOpenSavings} />
        <SettingsLinkRow label={t("settings.overview.plans")} onPress={onOpenPlans} />
      </SettingsSection>

      <SettingsSection title={t("settings.overview.appPreferences")}>
        <SettingsLinkRow label={t("settings.overview.localeCurrency")} value={currencyLabel} onPress={onOpenLocale} />
        <SettingsLinkRow label={t("settings.overview.notifications")} value={notificationsLabel} onPress={onOpenNotifications} />
      </SettingsSection>

      <SettingsSection title={t("settings.overview.about")}>
        <SettingsLinkRow label={t("settings.overview.aboutBudgetInCheck")} value={versionLabel} onPress={onOpenAbout} />
        <SettingsLinkRow label={t("settings.overview.privacyPolicy")} onPress={onOpenPrivacy} />
      </SettingsSection>

      <SettingsSection title={t("settings.dangerZoneTitle")}>
        <SettingsLinkRow label={t("settings.overview.resetSignOut")} onPress={onOpenDanger} danger />
      </SettingsSection>
    </>
  );
}