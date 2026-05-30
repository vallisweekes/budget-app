import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsSection from "@/components/Settings/SettingsSection";
import { useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsDangerTabProps } from "@/types/components/settings/SettingsDangerTab.types";

export default function SettingsDangerTab({ onResetData, resettingData, onSignOut }: SettingsDangerTabProps) {
  const { t } = useAppTranslation();

  return (
    <SettingsSection title={t("settings.dangerZoneTitle")}>
      <Text style={styles.muted}>{t("settings.danger.resetDescription")}</Text>
      <Pressable onPress={onResetData} style={styles.resetBtn}>
        <Ionicons name="refresh-circle-outline" size={18} color={T.red} />
        <Text style={styles.resetText}>{resettingData ? t("settings.danger.resetting") : t("settings.danger.resetData")}</Text>
      </Pressable>
      <Text style={styles.muted}>{t("settings.danger.signOutDescription")}</Text>
      <Pressable onPress={onSignOut} style={styles.signOutBtn}>
        <Ionicons name="log-out-outline" size={18} color={T.red} />
        <Text style={styles.signOutText}>{t("settings.danger.signOut")}</Text>
      </Pressable>
    </SettingsSection>
  );
}
