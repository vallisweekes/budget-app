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
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    borderTopWidth: 2,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
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
  value: { color: "#0f282f", fontSize: 22, fontWeight: "900", letterSpacing: -0.2 },
  neg: { color: "#e25c5c" },
  label: {
    color: "rgba(15,40,47,0.55)",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
