import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsSection from "@/components/Settings/SettingsSection";
import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsDangerTabProps } from "@/types/components/settings/SettingsDangerTab.types";

export default function SettingsDangerTab({ onResetData, resettingData, onSignOut }: SettingsDangerTabProps) {
  return (
    <SettingsSection title="Danger Zone">
      <Text style={styles.muted}>Resetting data removes your budget plans, income, expenses, debts, goals, allocations, categories, snapshots, and receipt scans. Your login stays, but you will sign in again and onboarding will restart from scratch.</Text>
      <Pressable onPress={onResetData} style={styles.resetBtn}>
        <Ionicons name="refresh-circle-outline" size={18} color={T.red} />
        <Text style={styles.resetText}>{resettingData ? "Resetting…" : "Reset Data"}</Text>
      </Pressable>
      <Text style={styles.muted}>Sign out only removes this device session.</Text>
      <Pressable onPress={onSignOut} style={styles.signOutBtn}>
        <Ionicons name="log-out-outline" size={18} color={T.red} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </SettingsSection>
  );
}
