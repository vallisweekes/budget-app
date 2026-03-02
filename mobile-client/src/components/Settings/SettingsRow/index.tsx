import React from "react";
import { Text, View } from "react-native";

import { styles } from "./styles";

import type { SettingsRowProps } from "@/types/components/settings/SettingsRow.types";

export default function SettingsRow({ label, value }: SettingsRowProps) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}
