import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsLinkRowProps } from "@/types/components/settings/SettingsLinkRow.types";

export default function SettingsLinkRow({ label, value, valueColor, onPress, danger = false }: SettingsLinkRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={16} color={danger ? T.red : T.textDim} />
      </View>
    </Pressable>
  );
}