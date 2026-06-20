import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTranslation } from "@/hooks";
import SettingsLinkRow from "@/components/Settings/SettingsLinkRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { styles } from "./styles";

import type { SettingsOverviewTabProps } from "@/types/components/settings/SettingsOverviewTab.types";

function toTitleCase(value: string): string {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function resolveAvatarInitial(name: string): string {
  const normalized = toTitleCase(name);
  return normalized.charAt(0) || "U";
}

export default function SettingsOverviewTab({
  profileName,
  avatarUrl,
  onPressAvatar,
  onOpenPersonal,
  onOpenBudget,
  onOpenSavings,
  onOpenPreferences,
  onOpenPrivacy,
  onSignOut,
}: SettingsOverviewTabProps) {
  const { t } = useAppTranslation();
  const displayName = toTitleCase(profileName);
  const initials = resolveAvatarInitial(displayName);

  return (
    <>
      <View style={styles.profileHeaderWrap}>
        <Pressable onPress={onPressAvatar} style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </Pressable>
        <Text style={styles.profileName}>{displayName || t("common.notSet")}</Text>
      </View>

      <SettingsSection title="Settings">
        <SettingsLinkRow label="Personal details" icon="person-circle-outline" onPress={onOpenPersonal} />
        <SettingsLinkRow label="Budget details" icon="wallet-outline" onPress={onOpenBudget} />
        <SettingsLinkRow label={t("settings.overview.savingsAndCards")} icon="cash-outline" onPress={onOpenSavings} />
        <SettingsLinkRow label="App preferences" icon="options-outline" onPress={onOpenPreferences} />
        <SettingsLinkRow label={t("settings.overview.privacyPolicy")} icon="document-text-outline" onPress={onOpenPrivacy} />
        <SettingsLinkRow label={t("settings.overview.resetSignOut")} icon="log-out-outline" onPress={onSignOut} />
      </SettingsSection>
    </>
  );
}