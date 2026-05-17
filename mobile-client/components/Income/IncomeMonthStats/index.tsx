import React from "react";
import { Pressable, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { computeMoneyLeftVsLastMonth, formatIncomePct } from "@/lib/domain/incomeStats";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import type { IncomeMonthStatsProps } from "@/types";

export default function IncomeMonthStats({ data: a, currency, fmt, onPressIncomeSacrifice }: IncomeMonthStatsProps) {
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
        <Card label="Total income" value={fmt(a.grossIncome, currency)} color={T.green} iconName="sparkles-outline" />
        <Card
          label="Sacrifices"
          value={fmt(a.incomeSacrifice, currency)}
          color={T.accent}
          subValue={incomeSacrificePctLabel}
          subColor={T.accent}
          onPress={onPressIncomeSacrifice}
          iconName="diamond-outline"
        />
      </View>

      {/* Secondary row */}
      <View style={styles.row}>
        {/* Money left with badge */}
        <View style={[styles.card, { flex: 1 }]}>
          <View style={[styles.cardGlow, { backgroundColor: `${a.moneyLeftAfterPlan < 0 ? T.red : T.green}16` }]} />
          <View style={styles.cardInnerBorder} />
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWrap}>
              <View style={[styles.iconPill, { backgroundColor: `${a.moneyLeftAfterPlan < 0 ? T.red : T.green}14`, borderColor: `${a.moneyLeftAfterPlan < 0 ? T.red : T.green}33` }]}>
                <Ionicons name="wallet-outline" size={14} color={a.moneyLeftAfterPlan < 0 ? T.red : T.green} />
              </View>
              <Text style={styles.cardLabel}>Money left (after plan)</Text>
            </View>
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
        <Card label="Left to pay (right now)" value={fmt(a.leftToPayRightNow, currency)} color={T.accent} iconName="receipt-outline" />
      </View>

    </>
  );
}

function Card({ label, value, color, subValue, subColor, onPress, iconName }: { label: string; value: string; color: string; subValue?: string; subColor?: string; onPress?: () => void; iconName: keyof typeof Ionicons.glyphMap }) {
  const content = (
    <>
      <View style={[styles.cardGlow, { backgroundColor: `${color}16` }]} />
      <View style={styles.cardInnerBorder} />
      <View style={styles.cardTitleWrap}>
        <View style={[styles.iconPill, { backgroundColor: `${color}14`, borderColor: `${color}33` }]}>
          <Ionicons name={iconName} size={14} color={color} />
        </View>
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
      <View style={styles.valueInline}>
        <Text style={[styles.cardValue, { color }]}>{value}</Text>
        {subValue ? <Text style={[styles.cardPctInline, { color: subColor ?? T.textDim }]}>{subValue}</Text> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>{content}</View>
  );
}
