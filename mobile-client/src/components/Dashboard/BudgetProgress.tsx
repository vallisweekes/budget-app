import React from "react";
import { View, Text, StyleSheet } from "react-native";

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
              backgroundColor: isOverBudget ? "#e25c5c" : "#02eff0",
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
    backgroundColor: "#0a1e23",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  title: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600" },
  pct: { color: "#fff", fontSize: 14, fontWeight: "700" },
  over: { color: "#e25c5c" },
  bg: { height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  sub: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 8 },
});
