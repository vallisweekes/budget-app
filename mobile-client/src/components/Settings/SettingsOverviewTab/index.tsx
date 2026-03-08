import React from "react";

import SettingsLinkRow from "@/components/Settings/SettingsLinkRow";
import SettingsSection from "@/components/Settings/SettingsSection";

import type { SettingsOverviewTabProps } from "@/types/components/settings/SettingsOverviewTab.types";

export default function SettingsOverviewTab({
  profileLabel,
  subscriptionLabel,
  payDateLabel,
  payFrequencyLabel,
  debtManagementLabel,
  currencyLabel,
  notificationsLabel,
  versionLabel,
  onEditProfile,
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
  return (
    <>
      <SettingsSection title="Account">
        <SettingsLinkRow label="Profile details" value={profileLabel} onPress={onEditProfile} />
        <SettingsLinkRow label="Subscription" value={subscriptionLabel} onPress={onOpenSubscription} />
      </SettingsSection>

      <SettingsSection title="Budgeting">
        <SettingsLinkRow label="Budget setup" value={payDateLabel} onPress={onOpenBudget} />
        <SettingsLinkRow label="Pay schedule" value={payFrequencyLabel} onPress={onOpenBudget} />
        <SettingsLinkRow label="Income settings" onPress={onOpenIncomeSettings} />
        <SettingsLinkRow label="Debt management" value={debtManagementLabel} onPress={onOpenDebtManagement} />
        <SettingsLinkRow label="Savings and cards" onPress={onOpenSavings} />
        <SettingsLinkRow label="Plans" onPress={onOpenPlans} />
      </SettingsSection>

      <SettingsSection title="App Preferences">
        <SettingsLinkRow label="Locale & currency" value={currencyLabel} onPress={onOpenLocale} />
        <SettingsLinkRow label="Notifications" value={notificationsLabel} onPress={onOpenNotifications} />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsLinkRow label="About BudgetIn Check" value={versionLabel} onPress={onOpenAbout} />
        <SettingsLinkRow label="Privacy Policy" onPress={onOpenPrivacy} />
      </SettingsSection>

      <SettingsSection title="Danger Zone">
        <SettingsLinkRow label="Reset & sign out" onPress={onOpenDanger} danger />
      </SettingsSection>
    </>
  );
}