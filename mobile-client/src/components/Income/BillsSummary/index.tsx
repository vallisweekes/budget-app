import React from "react";
import { View, Text } from "react-native";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";
import { styles } from "./styles";
import type { BillsSummaryProps } from "@/types";

export default function BillsSummary({ data: a, currency, fmt }: BillsSummaryProps) {
  return (
    <View style={styles.wrap}>
      <Stat label="Bills planned" value={fmt(a.plannedBills, currency)} />
      <Stat label="Paid so far" value={fmt(a.paidBillsSoFar, currency)} />
      <Stat label="Remaining" value={fmt(a.remainingBills, currency)} />
      <Stat label="Sources" value={String(a.sourceCount ?? 0)} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
