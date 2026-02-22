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
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  title: {
    color: "rgba(15,40,47,0.55)",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pct: { color: "#0f282f", fontSize: 16, fontWeight: "900", letterSpacing: -0.1 },
  over: { color: "#e25c5c" },
  bg: { height: 10, backgroundColor: "rgba(15,40,47,0.10)", borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  sub: { color: "rgba(15,40,47,0.62)", fontSize: 12, marginTop: 10, fontWeight: "600" },
});
