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
  return (
    <>
      {/* Top stat cards */}
      <View style={s.row}>
        <Card label="Total income" value={fmt(a.grossIncome, currency)} color={T.green} />
        <Card label="Expenses" value={fmt(a.plannedExpenses, currency)} color={T.red} />
      </View>
      <View style={s.row}>
        <Card label="Debts" value={fmt(a.plannedDebtPayments, currency)} color={T.orange} />
        <Card label="Income sacrifice" value={fmt(a.incomeSacrifice, currency)} color={T.accent} />
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
          <Text style={[s.cardValue, a.moneyLeftAfterPlan < 0 && s.negative]}>
            {fmt(a.moneyLeftAfterPlan, currency)}
          </Text>
        </View>
        <Card label="Income left now" value={fmt(a.incomeLeftRightNow, currency)} color={T.accent} />
      </View>

      {/* Annotation pills */}
      <View style={s.pills}>
        <Pill label="Allowance" value={fmt(a.monthlyAllowance, currency)} />
        <Pill label="Sacrifice" value={fmt(a.incomeSacrifice, currency)} />
        <Pill label="Money out" value={fmt(a.moneyOutTotal, currency)} />
      </View>
    </>
  );
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.card}>
      <Text style={s.cardLabel}>{label}</Text>
      <Text style={[s.cardValue, { color }]}>{value}</Text>
    </View>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.pill}>
      <Text style={s.pillLabel}>{label}:</Text>
      <Text style={s.pillValue}>{value}</Text>
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
  cardValue: { color: T.text, fontSize: 17, fontWeight: "900" },
  negative: { color: T.red },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeOn: { backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border },
  badgeOver: { backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  badgeTextOn: { color: T.green },
  badgeTextOver: { color: T.red },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, marginTop: 10 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: T.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: T.border,
  },
  pillLabel: { color: T.textDim, fontSize: 11, fontWeight: "700" },
  pillValue: { color: T.text, fontSize: 11, fontWeight: "900" },
});
