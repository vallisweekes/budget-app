import React from "react";
import { Pressable, Text, View } from "react-native";

import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { styles } from "./styles";

import type { SettingsDetailsTabProps } from "@/types/components/settings/SettingsDetailsTab.types";

export default function SettingsDetailsTab({ username, email, country, onEdit }: SettingsDetailsTabProps) {
  return (
    <>
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{username.slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{username}</Text>
          <Text style={styles.profileSub}>{email}</Text>
        </View>
        <Pressable onPress={onEdit} style={styles.outlineBtn}><Text style={styles.outlineBtnText}>Edit</Text></Pressable>
      </View>

      <SettingsSection title="Details">
        <SettingsRow label="Username" value={username} />
        <SettingsRow label="Email" value={email || "Not set"} />
        <SettingsRow label="Country" value={country} />
      </SettingsSection>
    </>
  );
}
