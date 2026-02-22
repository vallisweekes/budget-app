import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent: string;
  negative?: boolean;
}

export function StatCard({ label, value, icon, accent, negative = false }: Props) {
  return (
    <View style={[s.card, { borderTopColor: accent }]}>
      <Ionicons name={icon} size={18} color={accent} style={s.icon} />
      <Text style={[s.value, negative && s.neg]}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: "#0a1e23",
    borderRadius: 14,
    padding: 16,
    borderTopWidth: 3,
  },
  icon: { marginBottom: 8, opacity: 0.9 },
  value: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 2 },
  neg: { color: "#e25c5c" },
  label: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
});
