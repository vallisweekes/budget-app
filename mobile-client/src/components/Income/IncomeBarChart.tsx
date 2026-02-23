import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { T } from "@/lib/theme";

interface Props {
  data: IncomeMonthData;
  currency: string;
}

const W = Dimensions.get("window").width;

export default function IncomeBarChart({ data: a, currency }: Props) {
  const chartWidth = W - 80;
  const maxVal = Math.max(a.grossIncome, a.moneyOutTotal) * 1.15;

  const stackData = [
    {
      stacks: [{ value: a.grossIncome, color: T.green }],
      label: "In",
    },
    {
      stacks: [
        { value: a.plannedExpenses, color: T.red },
        { value: a.plannedDebtPayments, color: T.orange },
        { value: a.monthlyAllowance, color: T.accent },
        { value: Math.max(0, a.incomeSacrifice - a.monthlyAllowance), color: T.accentFaint },
      ],
      label: "Out",
    },
  ];

  return (
    <View style={s.wrap}>
      <BarChart
        stackData={stackData}
        width={chartWidth}
        height={140}
        barWidth={40}
        spacing={50}
        maxValue={maxVal || 1}
        noOfSections={4}
        barBorderRadius={4}
        xAxisColor={T.border}
        yAxisColor={T.border}
        yAxisTextStyle={{ color: T.textDim, fontSize: 9, fontWeight: "600" }}
        xAxisLabelTextStyle={{
          color: T.textDim,
          fontSize: 11,
          fontWeight: "600",
        }}
        hideRules
        disablePress
        formatYLabel={(val: string) => {
          const n = Number(val);
          if (n >= 1000) return `${currency}${(n / 1000).toFixed(0)}k`;
          return `${currency}${n}`;
        }}
      />
      <View style={s.legend}>
        {LEGEND.map(([color, label]) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: color }]} />
            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const LEGEND: [string, string][] = [
  [T.green, "Income"],
  [T.red, "Bills"],
  [T.orange, "Debts"],
  [T.accent, "Allowance"],
  [T.accentFaint, "Sacrifice"],
];

const s = StyleSheet.create({
  wrap: { alignItems: "center" },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
    justifyContent: "center",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: T.textDim, fontSize: 10, fontWeight: "600" },
});
