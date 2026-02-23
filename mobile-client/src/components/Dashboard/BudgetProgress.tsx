import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardBase, textCaption, textLabel } from "@/lib/ui";

interface Props {
  progressPct: number;
  isOverBudget: boolean;
  amountAfterExpenses: number;
  currency: string;
  fmt: (v: number | string | null | undefined, c: string) => string;
}

export function BudgetProgress({ progressPct, isOverBudget, amountAfterExpenses, currency, fmt }: Props) {
  if (progressPct <= 0) return null;
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>Budget used</Text>
        <Text style={[s.pct, isOverBudget && s.over]}>{progressPct.toFixed(0)}%</Text>
      </View>
      <View style={s.bg}>
        <View
          style={[
            s.fill,
            {
              width: `${progressPct}%` as `${number}%`,
              backgroundColor: isOverBudget ? "#e25c5c" : T.accent,
            },
          ]}
        />
      </View>
      <Text style={s.sub}>
        {isOverBudget
          ? `Over budget by ${fmt(Math.abs(amountAfterExpenses), currency)}`
          : `${fmt(amountAfterExpenses, currency)} left for this month`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
    ...cardBase,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  title: { ...textLabel },
  pct: { color: T.text, fontSize: 16, fontWeight: "900", letterSpacing: -0.1 },
  over: { color: T.red },
  bg: { height: 10, backgroundColor: T.border, borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  sub: { ...textCaption, marginTop: 10 },
});
