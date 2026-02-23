import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/lib/theme";
import { cardElevated, textLabel, textValue } from "@/lib/ui";

interface Props {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent: string;
  negative?: boolean;
}

export function StatCard({ label, value, icon, accent, negative = false }: Props) {
  return (
    <View style={s.card}>
      <View style={[s.iconChip, { backgroundColor: `${accent}1A` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[s.label, s.labelTop]}>{label}</Text>
      <Text style={[s.value, negative && s.neg]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "44%",
    padding: 16,
    ...cardElevated,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  labelTop: { marginBottom: 4 },
  value: { ...textValue },
  neg: { color: T.red },
  label: { ...textLabel },
});
