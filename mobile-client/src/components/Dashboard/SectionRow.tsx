import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  label: string;
  value: string;
  sub?: string;
}

export function SectionRow({ label, value, sub }: Props) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <View style={s.right}>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
        <Text style={s.value}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  value: { color: "#fff", fontSize: 14, fontWeight: "600" },
  sub: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
});
