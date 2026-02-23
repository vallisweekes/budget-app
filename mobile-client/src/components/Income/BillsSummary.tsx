import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

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
    ...cardBase,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: "center" },
  label: { color: T.textDim, fontSize: 10, marginBottom: 2, fontWeight: "700" },
  value: { color: T.text, fontSize: 12, fontWeight: "900" },
});
