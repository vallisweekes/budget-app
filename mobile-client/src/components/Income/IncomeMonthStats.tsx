import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

interface Props {
  data: IncomeMonthData;
  currency: string;
  fmt: (v: number, c: string) => string;
}

export default function IncomeMonthStats({ data: a, currency, fmt }: Props) {
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
      <View style={s.row}>
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
      <View style={s.row}>
        {/* Money left with badge */}
        <View style={[s.card, { flex: 1 }]}>
          <View style={s.cardHeader}>
            <Text style={s.cardLabel}>Money left</Text>
            <View style={[s.badge, a.isOnPlan ? s.badgeOn : s.badgeOver]}>
              <Text style={[s.badgeText, a.isOnPlan ? s.badgeTextOn : s.badgeTextOver]}>
                {a.isOnPlan ? "On plan" : "Over plan"}
              </Text>
            </View>
          </View>
          <View style={s.valueInline}>
            <Text style={[s.cardValue, a.moneyLeftAfterPlan < 0 && s.negative]}>
              {fmt(a.moneyLeftAfterPlan, currency)}
            </Text>
          </View>
          {moneyLeftVsLastMonth !== null ? (
            <Text style={[s.cardSubline, moneyLeftVsLastMonth < 0 ? s.negative : s.positive]}>
              {`${moneyLeftVsLastMonth >= 0 ? "+" : ""}${moneyLeftVsLastMonth.toFixed(1)}% vs last month`}
            </Text>
          ) : (
            <Text style={[s.cardSubline, a.moneyLeftAfterPlan < 0 ? s.negative : s.positive]}>
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
    <View style={s.card}>
      <Text style={s.cardLabel}>{label}</Text>
      <View style={s.valueInline}>
        <Text style={[s.cardValue, { color }]}>{value}</Text>
        {subValue ? <Text style={[s.cardPctInline, { color: subColor ?? T.textDim }]}>{subValue}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, paddingHorizontal: 14, marginTop: 10 },
  card: {
    flex: 1,
    ...cardBase,
    padding: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { color: T.textDim, fontSize: 11, fontWeight: "700", marginBottom: 4 },
  valueInline: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  cardValue: { color: T.text, fontSize: 17, fontWeight: "900" },
  cardPctInline: { color: T.textDim, fontSize: 11, fontWeight: "800" },
  cardSubline: { fontSize: 11, fontWeight: "800", marginTop: 2 },
  positive: { color: T.green },
  negative: { color: T.red },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeOn: { backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border },
  badgeOver: { backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  badgeTextOn: { color: T.green },
  badgeTextOver: { color: T.red },
});
