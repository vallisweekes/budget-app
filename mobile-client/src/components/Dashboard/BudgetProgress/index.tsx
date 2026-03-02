import React from "react";
import { View, Text } from "react-native";
import { T } from "@/lib/theme";
import { cardBase, textCaption, textLabel } from "@/lib/ui";
import { styles } from "./styles";
import type { BudgetProgressProps } from "@/types";

export function BudgetProgress({ progressPct, isOverBudget, amountAfterExpenses, currency, fmt }: BudgetProgressProps) {
  if (progressPct <= 0) return null;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Budget used</Text>
        <Text style={[styles.pct, isOverBudget && styles.over]}>{progressPct.toFixed(0)}%</Text>
      </View>
      <View style={styles.bg}>
        <View
          style={[
            styles.fill,
            {
              width: `${progressPct}%` as `${number}%`,
              backgroundColor: isOverBudget ? "#e25c5c" : T.accent,
            },
          ]}
        />
      </View>
      <Text style={styles.sub}>
        {isOverBudget
          ? `Over budget by ${fmt(Math.abs(amountAfterExpenses), currency)}`
          : `${fmt(amountAfterExpenses, currency)} left for this month`}
      </Text>
    </View>
  );
}
