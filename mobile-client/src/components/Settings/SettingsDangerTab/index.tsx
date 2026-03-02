import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsSection from "@/components/Settings/SettingsSection";
import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsDangerTabProps } from "@/types/components/settings/SettingsDangerTab.types";

export default function SettingsDangerTab({ onSignOut }: SettingsDangerTabProps) {
  return (
    <SettingsSection title="Danger Zone">
      <Text style={styles.muted}>Sign out from this device.</Text>
      <Pressable onPress={onSignOut} style={styles.signOutBtn}>
        <Ionicons name="log-out-outline" size={18} color={T.red} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </SettingsSection>
  );
}
