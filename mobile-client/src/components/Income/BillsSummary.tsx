import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { IncomeMonthData } from "@/lib/apiTypes";

interface Props {
  data: IncomeMonthData;
  currency: string;
  fmt: (v: number, c: string) => string;
}

export default function BillsSummary({ data: a, currency, fmt }: Props) {
  return (
    <View style={s.wrap}>
      <Stat label="Bills planned" value={fmt(a.plannedBills, currency)} />
      <Stat label="Paid so far" value={fmt(a.paidBillsSoFar, currency)} />
      <Stat label="Remaining" value={fmt(a.remainingBills, currency)} />
      <Stat label="Sources" value={String(a.sourceCount ?? 0)} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.item}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: "#0a1e23",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  item: { flex: 1, alignItems: "center" },
  label: { color: "rgba(255,255,255,0.35)", fontSize: 10, marginBottom: 2 },
  value: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
