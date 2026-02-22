import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { PieChart } from "react-native-gifted-charts";

interface Props {
  totalBudget: number;
  totalExpenses: number;
  paidTotal: number;
  currency: string;
  fmt: (v: number | string | null | undefined, c: string) => string;
}

const W = Dimensions.get("window").width;

export default function BudgetDonutCard({ totalBudget, totalExpenses, paidTotal, currency, fmt }: Props) {
  const { remaining, committed, isOverBudget, chartData } = useMemo(() => {
    const safeTotalBudget = Math.max(0, totalBudget ?? 0);
    const safeTotalExpenses = Math.max(0, totalExpenses ?? 0);
    const safePaidTotal = Math.max(0, paidTotal ?? 0);

    const paid = Math.min(safeTotalExpenses, safePaidTotal);
    const committedSpending = Math.max(0, safeTotalExpenses - paid);
    const left = safeTotalBudget - safeTotalExpenses;
    const over = left < 0;

    const remainingValue = Math.max(0, left);

    const data = over
      ? [
          { value: committedSpending, color: "#a78bfa" },
          { value: paid, color: "#3ec97e" },
        ]
      : [
          { value: remainingValue, color: "rgba(15,40,47,0.08)" },
          { value: committedSpending, color: "#a78bfa" },
          { value: paid, color: "#3ec97e" },
        ];

    return {
      remaining: left,
      committed: committedSpending,
      isOverBudget: over,
      chartData: data,
    };
  }, [paidTotal, totalBudget, totalExpenses]);

  if (!(totalBudget > 0) && !(totalExpenses > 0)) return null;

  const radius = Math.min(120, Math.max(92, Math.floor((W - 64) / 2.6)));
  const innerRadius = Math.floor(radius * 0.72);

  const centerTop = isOverBudget ? "Over" : fmt(Math.max(0, remaining), currency);
  const centerSub = isOverBudget
    ? `by ${fmt(Math.abs(remaining), currency)}`
    : `left of ${fmt(totalBudget, currency)}`;

  return (
    <View style={s.card}>
      <PieChart
        data={chartData}
        donut
        radius={radius}
        innerRadius={innerRadius}
        strokeWidth={2}
        strokeColor="#ffffff"
        showText={false}
        focusOnPress={false}
        isAnimated
        animationDuration={500}
        centerLabelComponent={() => (
          <View style={{ alignItems: "center" }}>
            <Text style={s.centerValue}>{centerTop}</Text>
            <Text style={s.centerSub}>{centerSub}</Text>
          </View>
        )}
      />

      <View style={s.legend}>
        <View style={s.legendRow}>
          <View style={[s.dot, { backgroundColor: "#3ec97e" }]} />
          <Text style={s.legendLabel}>Spending</Text>
          <Text style={s.legendValue}>{fmt(Math.min(paidTotal, totalExpenses), currency)}</Text>
        </View>
        <View style={s.legendRow}>
          <View style={[s.dot, { backgroundColor: "#a78bfa" }]} />
          <Text style={s.legendLabel}>Committed spending</Text>
          <Text style={s.legendValue}>{fmt(committed, currency)}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  centerValue: {
    color: "#0f282f",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  centerSub: {
    marginTop: 4,
    color: "rgba(15,40,47,0.55)",
    fontSize: 12,
    fontWeight: "700",
  },
  legend: {
    width: "100%",
    marginTop: 14,
    gap: 14,
  },
  legendRow: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  legendLabel: {
    flex: 1,
    color: "rgba(15,40,47,0.75)",
    fontSize: 14,
    fontWeight: "800",
  },
  legendValue: {
    color: "rgba(15,40,47,0.80)",
    fontSize: 14,
    fontWeight: "900",
  },
});
