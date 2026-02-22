import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface StatGridProps {
  totalAmount: number;
  totalCount: number;
  paidAmount: number;
  paidCount: number;
  unpaidAmount: number;
  unpaidCount: number;
  currency: string;
  fmt: (v: number, c: string) => string;
}

export default function ExpenseStatGrid({
  totalAmount,
  totalCount,
  unpaidAmount,
  unpaidCount,
  currency,
  fmt,
}: StatGridProps) {
  return (
    <View style={s.stack}>
      <View style={s.card}>
        <Text style={s.lbl}>Total</Text>
        <Text style={[s.val, { color: "#fff" }]}>{fmt(totalAmount, currency)}</Text>
        <Text style={s.sub}>{totalCount} bill{totalCount !== 1 ? "s" : ""}</Text>
      </View>
      <View style={[s.card, s.cardOrange]}>
        <Text style={s.lbl}>Remaining</Text>
        <Text style={[s.val, { color: "#f4a942" }]}>{fmt(unpaidAmount, currency)}</Text>
        <Text style={s.sub}>{unpaidCount} due</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  stack: {
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  card: {
    backgroundColor: "#0a1e23",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardOrange: {
    borderColor: "rgba(244,169,66,0.18)",
  },
  lbl: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  val: { fontWeight: "700", fontSize: 24 },
  sub: { color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 },
});
