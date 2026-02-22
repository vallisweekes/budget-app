import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { IncomeMonthData } from "@/lib/apiTypes";

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
        <Card label="Total income" value={fmt(a.grossIncome, currency)} color="#3ec97e" />
        <Card label="Expenses" value={fmt(a.plannedExpenses, currency)} color="#e25c5c" />
      </View>
      <View style={s.row}>
        <Card label="Debts" value={fmt(a.plannedDebtPayments, currency)} color="#f4a942" />
        <Card label="Income sacrifice" value={fmt(a.incomeSacrifice, currency)} color="#a78bfa" />
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
        <Card label="Income left now" value={fmt(a.incomeLeftRightNow, currency)} color="#38bdf8" />
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
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { color: "rgba(15,40,47,0.55)", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  cardValue: { color: "#0f282f", fontSize: 17, fontWeight: "900" },
  negative: { color: "#e25c5c" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeOn: { backgroundColor: "rgba(62,201,126,0.15)" },
  badgeOver: { backgroundColor: "rgba(226,92,92,0.15)" },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  badgeTextOn: { color: "#3ec97e" },
  badgeTextOver: { color: "#e25c5c" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, marginTop: 10 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
  },
  pillLabel: { color: "rgba(15,40,47,0.55)", fontSize: 11, fontWeight: "700" },
  pillValue: { color: "#0f282f", fontSize: 11, fontWeight: "900" },
});
