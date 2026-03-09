import React from "react";
import { Text, View } from "react-native";

import { styles } from "./styles";

import type { SettingsSectionProps } from "@/types/components/settings/SettingsSection.types";

export default function SettingsSection({ title, right, children }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}
