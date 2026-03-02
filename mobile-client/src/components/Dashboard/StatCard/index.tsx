import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/lib/theme";
import { cardElevated, textLabel, textValue } from "@/lib/ui";
import { styles } from "./styles";
import type { StatCardProps } from "@/types";

export function StatCard({ label, value, icon, accent, negative = false }: StatCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconChip, { backgroundColor: `${accent}1A` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.label, styles.labelTop]}>{label}</Text>
      <Text style={[styles.value, negative && styles.neg]}>{value}</Text>
    </View>
  );
}
