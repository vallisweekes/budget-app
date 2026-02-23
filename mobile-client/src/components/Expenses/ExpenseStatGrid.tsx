import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

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
        <Text style={[s.val, { color: T.text }]}>{fmt(totalAmount, currency)}</Text>
        <Text style={s.sub}>{totalCount} bill{totalCount !== 1 ? "s" : ""}</Text>
      </View>
      <View style={[s.card, s.cardOrange]}>
        <Text style={s.lbl}>Remaining</Text>
        <Text style={[s.val, { color: T.orange }]}>{fmt(unpaidAmount, currency)}</Text>
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
    ...cardBase,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardOrange: {
    borderColor: T.border,
  },
  lbl: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  val: { fontWeight: "700", fontSize: 24 },
  sub: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
});
