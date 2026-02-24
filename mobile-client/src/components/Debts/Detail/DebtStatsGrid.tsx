import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { T } from "@/lib/theme";

type Props = {
  isCardDebt: boolean;
  creditLimit: string;
  original: string;
  paidSoFar: string;
  dueCoveredThisCycle: boolean;
  dueDateLabel: string;
  dueStatusSub?: string;
  dueTone: "normal" | "green" | "orange" | "red";
  monthlyOrInterestLabel: string;
  monthlyOrInterestValue: string;
};

export default function DebtStatsGrid({
  isCardDebt,
  creditLimit,
  original,
  paidSoFar,
  dueCoveredThisCycle,
  dueDateLabel,
  dueStatusSub,
  dueTone,
  monthlyOrInterestLabel,
  monthlyOrInterestValue,
}: Props) {
  const dueColor = dueTone === "green" ? T.green : dueTone === "orange" ? T.orange : dueTone === "red" ? T.red : T.text;

  return (
    <View style={s.statsGrid}>
      <View style={s.statCardMini}>
        <Text style={s.statLabel}>{isCardDebt ? "Credit limit" : "Original"}</Text>
        <Text style={s.statValue}>{isCardDebt ? creditLimit : original}</Text>
      </View>

      <View style={s.statCardMini}>
        <Text style={s.statLabel}>Paid so far</Text>
        <Text style={[s.statValue, { color: T.green }]}>{paidSoFar}</Text>
      </View>

      <View style={s.statCardMini}>
        <Text style={s.statLabel}>{dueCoveredThisCycle ? "Payment status" : "Due date"}</Text>
        <Text style={[s.statValue, { color: dueColor }]}>{dueCoveredThisCycle ? "Paid" : dueDateLabel}</Text>
        {dueStatusSub ? <Text style={s.statSub}>{dueStatusSub}</Text> : null}
      </View>

      <View style={s.statCardMini}>
        <Text style={s.statLabel}>{monthlyOrInterestLabel}</Text>
        <Text style={s.statValue}>{monthlyOrInterestValue}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCardMini: {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: T.accentBorder,
    width: "48%",
    minHeight: 98,
    justifyContent: "space-between",
  },
  statLabel: { color: T.textDim, fontSize: 11, fontWeight: "800", marginBottom: 4 },
  statValue: { color: T.text, fontSize: 16, fontWeight: "900" },
  statSub: { color: T.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
});
