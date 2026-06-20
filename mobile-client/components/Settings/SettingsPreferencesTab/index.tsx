import React from "react";

import SettingsLinkRow from "@/components/Settings/SettingsLinkRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { useAppTranslation } from "@/hooks";

type SettingsPreferencesTabProps = {
  currencyLabel: string;
  notificationsLabel: string;
  versionLabel: string;
  onOpenLocale: () => void;
  onOpenNotifications: () => void;
  onOpenAbout: () => void;
  onOpenPrivacy: () => void;
};

export default function SettingsPreferencesTab({
  currencyLabel,
  notificationsLabel,
  versionLabel,
  onOpenLocale,
  onOpenNotifications,
  onOpenAbout,
  onOpenPrivacy,
}: SettingsPreferencesTabProps) {
  const { t } = useAppTranslation();

  return (
    <>
      <SettingsSection title="App preferences">
        <SettingsLinkRow label={t("settings.overview.localeCurrency")} value={currencyLabel} onPress={onOpenLocale} />
        <SettingsLinkRow label={t("settings.overview.notifications")} value={notificationsLabel} onPress={onOpenNotifications} />
      </SettingsSection>

      <SettingsSection title={t("settings.overview.about")}>
        <SettingsLinkRow label={t("settings.overview.aboutBudgetInCheck")} value={versionLabel} onPress={onOpenAbout} />
        <SettingsLinkRow label={t("settings.overview.privacyPolicy")} onPress={onOpenPrivacy} />
      </SettingsSection>
    </>
  );
}
