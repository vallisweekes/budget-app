import React from "react";
import { Text, View } from "react-native";

import type { DebtStatsGridProps } from "@/types";
import { T } from "@/lib/theme";
import { styles } from "./styles";

export default function DebtStatsGrid({
  isCardDebt,
  creditLimit,
  original,
  paidSoFarLabel,
  paidSoFar,
  paidSoFarTone = "green",
  dueDateLabel,
  dueStatusSub,
  dueTone,
  monthlyOrInterestLabel,
  monthlyOrInterestValue,
  monthlyOrInterestSub,
}: DebtStatsGridProps) {
  const dueColor = dueTone === "green" ? T.green : dueTone === "orange" ? T.orange : dueTone === "red" ? T.red : T.text;
  const paidSoFarColor = paidSoFarTone === "red" ? T.red : paidSoFarTone === "normal" ? T.text : T.green;

  return (
    <View style={styles.statsGrid}>
      <View style={styles.statCardMini}>
        <Text style={styles.statLabel}>{isCardDebt ? "Credit limit" : "Original"}</Text>
        <Text style={styles.statValue}>{isCardDebt ? creditLimit : original}</Text>
      </View>

      <View style={styles.statCardMini}>
        <Text style={styles.statLabel}>{paidSoFarLabel ?? "Paid so far"}</Text>
        <Text style={[styles.statValue, { color: paidSoFarColor }]}>{paidSoFar}</Text>
      </View>

      <View style={styles.statCardMini}>
        <Text style={styles.statLabel}>Due date</Text>
        <Text style={[styles.statValue, { color: dueColor }]}>{dueDateLabel}</Text>
        {dueStatusSub ? <Text style={styles.statSub}>{dueStatusSub}</Text> : null}
      </View>

      <View style={styles.statCardMini}>
        <Text style={styles.statLabel}>{monthlyOrInterestLabel}</Text>
        <Text style={styles.statValue}>{monthlyOrInterestValue}</Text>
        {monthlyOrInterestSub ? <Text style={styles.statSub}>{monthlyOrInterestSub}</Text> : null}
      </View>
    </View>
  );
}
