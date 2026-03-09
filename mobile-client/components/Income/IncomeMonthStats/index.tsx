import React from "react";
import { View, Text } from "react-native";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { computeMoneyLeftVsLastMonth, formatIncomePct } from "@/lib/domain/incomeStats";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";
import { styles } from "./styles";
import type { IncomeMonthStatsProps } from "@/types";

export default function IncomeMonthStats({ data: a, currency, fmt }: IncomeMonthStatsProps) {
  const moneyLeftVsLastMonth =
    typeof a.moneyLeftVsLastMonthPct === "number"
      ? a.moneyLeftVsLastMonthPct
      : computeMoneyLeftVsLastMonth(a.previousMoneyLeftAfterPlan, a.moneyLeftAfterPlan);
  const incomeSacrificePctLabel =
    typeof a.incomeSacrificePct === "number"
      ? `${a.incomeSacrificePct.toFixed(1)}%`
      : formatIncomePct(a.incomeSacrifice, a.grossIncome);
  const moneyLeftPctLabel =
    typeof a.moneyLeftPctOfGross === "number"
      ? `${a.moneyLeftPctOfGross.toFixed(1)}%`
      : formatIncomePct(a.moneyLeftAfterPlan, a.grossIncome);
  const isOnPlan = a.planStatusTag ? a.planStatusTag === "on_plan" : a.isOnPlan;
  const planStatusDescription = a.planStatusDescription ?? (isOnPlan ? "On plan" : "Over plan");

  return (
    <>
      {/* Top stat cards */}
      <View style={styles.row}>
        <Card label="Total income" value={fmt(a.grossIncome, currency)} color={T.green} />
        <Card
          label="Income sacrifice"
          value={fmt(a.incomeSacrifice, currency)}
          color={T.accent}
          subValue={incomeSacrificePctLabel}
          subColor={T.accent}
        />
      </View>

      {/* Secondary row */}
      <View style={styles.row}>
        {/* Money left with badge */}
        <View style={[styles.card, { flex: 1 }]}>
          <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Money left (after plan)</Text>
            <View style={[styles.badge, isOnPlan ? styles.badgeOn : styles.badgeOver]}>
              <Text style={[styles.badgeText, isOnPlan ? styles.badgeTextOn : styles.badgeTextOver]}>
                {planStatusDescription}
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
              {moneyLeftPctLabel}
            </Text>
          )}
        </View>
        <Card label="Income left (right now)" value={fmt(a.incomeLeftRightNow, currency)} color={T.accent} />
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
