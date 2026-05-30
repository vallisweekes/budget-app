import React from "react";
import { Pressable, Text, View } from "react-native";

import { useAppTranslation } from "@/hooks";
import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { styles } from "./styles";

import { getCountryLabel, getLanguageLabel } from "@/lib/constants";
import type { SettingsLocaleTabProps } from "@/types/components/settings/SettingsLocaleTab.types";

export default function SettingsLocaleTab({
  country,
  language,
  currency,
  detectedCountry,
  onEdit,
  onUseDetected,
  canUseDetected,
}: SettingsLocaleTabProps) {
  const { t } = useAppTranslation(language);
  const localeLabel = React.useMemo(() => getCountryLabel(country) ?? t("settings.locale.unknownCountry"), [country, t]);
  const languageLabel = React.useMemo(() => getLanguageLabel(language), [language]);
  const detectedCountryLabel = React.useMemo(() => getCountryLabel(detectedCountry) ?? t("settings.locale.unknownCountry"), [detectedCountry, t]);

  return (
    <SettingsSection title={t("settings.locale.sectionTitle")} right={<Pressable onPress={onEdit} style={styles.outlineBtn}><Text style={styles.outlineBtnText}>{t("common.edit")}</Text></Pressable>}>
      <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
      <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />

      <View style={styles.localeRowsCard}>
        <SettingsRow label={t("settings.locale.countryLabel")} value={localeLabel} />
        <SettingsRow label={t("settings.locale.languageLabel")} value={languageLabel} />
        <SettingsRow label={t("settings.locale.currencyLabel")} value={currency} />
      </View>

      <Text style={styles.muted}>{t("settings.locale.detectedCountry", { country: detectedCountryLabel })}</Text>
      <Pressable onPress={onUseDetected} style={[styles.inlineAction, !canUseDetected ? styles.inlineActionDisabled : null]} disabled={!canUseDetected}>
        <Text style={styles.inlineActionText}>{t("settings.locale.useDetectedCountry")}</Text>
      </Pressable>
      <Text style={styles.hint}>{t("settings.locale.hint")}</Text>
    </SettingsSection>
  );
}
