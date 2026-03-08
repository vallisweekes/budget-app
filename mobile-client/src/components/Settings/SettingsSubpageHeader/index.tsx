import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsSubpageHeaderProps } from "@/types/components/settings/SettingsSubpageHeader.types";

export default function SettingsSubpageHeader({ title, onBack }: SettingsSubpageHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={16} color={T.text} />
        <Text style={styles.backLabel}>Settings</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}