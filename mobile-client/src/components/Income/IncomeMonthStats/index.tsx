import React from "react";
import { View, Text } from "react-native";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";
import { styles } from "./styles";
import type { IncomeMonthStatsProps } from "@/types";

export default function IncomeMonthStats({ data: a, currency, fmt }: IncomeMonthStatsProps) {
  const pct = (value: number) => {
    if (!a.grossIncome || a.grossIncome <= 0) return "0.0%";
    return `${((value / a.grossIncome) * 100).toFixed(1)}%`;
  };

  const moneyLeftVsLastMonth = (() => {
    const prev = Number(a.previousMoneyLeftAfterPlan ?? 0);
    const curr = Number(a.moneyLeftAfterPlan ?? 0);
    if (!Number.isFinite(prev) || prev === 0) return null;
    const change = ((curr - prev) / Math.abs(prev)) * 100;
    return Number.isFinite(change) ? change : null;
  })();

  return (
    <>
      {/* Top stat cards */}
      <View style={styles.row}>
        <Card label="Total income" value={fmt(a.grossIncome, currency)} color={T.green} />
        <Card
          label="Income sacrifice"
          value={fmt(a.incomeSacrifice, currency)}
          color={T.accent}
          subValue={pct(a.incomeSacrifice)}
          subColor={T.accent}
        />
      </View>

      {/* Secondary row */}
      <View style={styles.row}>
        {/* Money left with badge */}
        <View style={[styles.card, { flex: 1 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Money left</Text>
            <View style={[styles.badge, a.isOnPlan ? styles.badgeOn : styles.badgeOver]}>
              <Text style={[styles.badgeText, a.isOnPlan ? styles.badgeTextOn : styles.badgeTextOver]}>
                {a.isOnPlan ? "On plan" : "Over plan"}
              </Text>
            </View>
          </View>
          <View style={styles.valueInline}>
            <Text style={[styles.cardValue, a.moneyLeftAfterPlan < 0 && styles.negative]}>
              {fmt(a.moneyLeftAfterPlan, currency)}
            </Text>
          </View>
          {moneyLeftVsLastMonth !== null ? (
            <Text style={[styles.cardSubline, moneyLeftVsLastMonth < 0 ? styles.negative : styles.positive]}>
              {`${moneyLeftVsLastMonth >= 0 ? "+" : ""}${moneyLeftVsLastMonth.toFixed(1)}% vs last month`}
            </Text>
          ) : (
            <Text style={[styles.cardSubline, a.moneyLeftAfterPlan < 0 ? styles.negative : styles.positive]}>
              {pct(a.moneyLeftAfterPlan)}
            </Text>
          )}
        </View>
        <Card label="Remaining income" value={fmt(a.incomeLeftRightNow, currency)} color={T.accent} />
      </View>

    </>
  );
}

function Card({ label, value, color, subValue, subColor }: { label: string; value: string; color: string; subValue?: string; subColor?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <View style={styles.valueInline}>
        <Text style={[styles.cardValue, { color }]}>{value}</Text>
        {subValue ? <Text style={[styles.cardPctInline, { color: subColor ?? T.textDim }]}>{subValue}</Text> : null}
      </View>
    </View>
  );
}
