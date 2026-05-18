import React from "react";
import { Pressable, Text, View } from "react-native";

import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { styles } from "./styles";

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
  return (
    <SettingsSection title="Locale" right={<Pressable onPress={onEdit} style={styles.outlineBtn}><Text style={styles.outlineBtnText}>Edit</Text></Pressable>}>
      <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
      <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />

      <View style={styles.localeRowsCard}>
        <SettingsRow label="Country" value={country} />
        <SettingsRow label="Language" value={language} />
        <SettingsRow label="Currency" value={currency} />
      </View>

      <Text style={styles.muted}>Detected country: {detectedCountry ?? "Unknown"}</Text>
      <Pressable onPress={onUseDetected} style={[styles.inlineAction, !canUseDetected ? styles.inlineActionDisabled : null]} disabled={!canUseDetected}>
        <Text style={styles.inlineActionText}>Use detected country</Text>
      </Pressable>
      {country === "GB" ? <Text style={styles.hint}>UK stays fixed as your home country.</Text> : null}
    </SettingsSection>
  );
}
