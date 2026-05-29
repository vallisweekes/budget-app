import React from "react";
import { Pressable, Text, View } from "react-native";

import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { styles } from "./styles";

import { LOCALE_PRESET_OPTIONS } from "@/lib/constants";
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
  const localeLabel = React.useMemo(() => {
    const normalizedCountry = String(country ?? "").trim().toUpperCase();
    if (!normalizedCountry) return "Not set";
    return LOCALE_PRESET_OPTIONS.find((option) => option.countryCode === normalizedCountry)?.countryLabel ?? normalizedCountry;
  }, [country]);

  return (
    <SettingsSection title="Locale" right={<Pressable onPress={onEdit} style={styles.outlineBtn}><Text style={styles.outlineBtnText}>Edit</Text></Pressable>}>
      <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
      <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />

      <View style={styles.localeRowsCard}>
        <SettingsRow label="Locale" value={localeLabel} />
        <SettingsRow label="Language" value={language} />
        <SettingsRow label="Currency" value={currency} />
      </View>

      <Text style={styles.muted}>Detected country: {detectedCountry ?? "Unknown"}</Text>
      <Pressable onPress={onUseDetected} style={[styles.inlineAction, !canUseDetected ? styles.inlineActionDisabled : null]} disabled={!canUseDetected}>
        <Text style={styles.inlineActionText}>Use detected country</Text>
      </Pressable>
      <Text style={styles.hint}>Changing locale updates the display symbol and money formatting across the app. It does not convert your saved balances.</Text>
    </SettingsSection>
  );
}
