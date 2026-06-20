import React from "react";

import SettingsLinkRow from "@/components/Settings/SettingsLinkRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { useAppTranslation } from "@/hooks";

type SettingsPersonalTabProps = {
  profileLabel: string;
  emailVerificationLabel: string;
  emailVerificationColor?: string;
  subscriptionLabel: string;
  onEditProfile: () => void;
  onOpenEmailVerification: () => void;
  onOpenSubscription: () => void;
};

export default function SettingsPersonalTab({
  profileLabel,
  emailVerificationLabel,
  emailVerificationColor,
  subscriptionLabel,
  onEditProfile,
  onOpenEmailVerification,
  onOpenSubscription,
}: SettingsPersonalTabProps) {
  const { t } = useAppTranslation();

  return (
    <SettingsSection title="Personal details">
      <SettingsLinkRow label={t("settings.overview.profileDetails")} value={profileLabel} onPress={onEditProfile} />
      <SettingsLinkRow label={t("settings.overview.emailVerification")} value={emailVerificationLabel} valueColor={emailVerificationColor} onPress={onOpenEmailVerification} />
      <SettingsLinkRow label={t("settings.overview.subscription")} value={subscriptionLabel} onPress={onOpenSubscription} />
    </SettingsSection>
  );
}
