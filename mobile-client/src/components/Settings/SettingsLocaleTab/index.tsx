import React from "react";
import { Pressable, Text } from "react-native";

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
      <SettingsRow label="Country" value={country} />
      <SettingsRow label="Language" value={language} />
      <SettingsRow label="Currency" value={currency} />
      <Text style={styles.muted}>Detected country: {detectedCountry ?? "Unknown"}</Text>
      <Pressable onPress={onUseDetected} style={styles.inlineAction} disabled={!canUseDetected}>
        <Text style={styles.inlineActionText}>Use detected country</Text>
      </Pressable>
      {country === "GB" ? <Text style={styles.muted}>UK stays fixed as your home country.</Text> : null}
    </SettingsSection>
  );
}
