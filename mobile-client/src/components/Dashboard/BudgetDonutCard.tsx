import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { T } from "@/lib/theme";
import { textCaption, textValue } from "@/lib/ui";

interface Props {
  totalBudget: number;
  totalExpenses: number;
  paidTotal: number;
  currency: string;
  fmt: (v: number | string | null | undefined, c: string) => string;
}

const W = Dimensions.get("window").width;

export default function BudgetDonutCard({ totalBudget, totalExpenses, paidTotal, currency, fmt }: Props) {
  const { remaining, isOverBudget, chartData } = useMemo(() => {
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
          { value: committedSpending, color: T.accent },
          { value: paid, color: T.green },
        ]
      : [
          { value: remainingValue, color: T.border },
          { value: committedSpending, color: T.accent },
          { value: paid, color: T.green },
        ];

    return {
      remaining: left,
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
    <View style={s.wrap}>
      <PieChart
        data={chartData}
        donut
        radius={radius}
        innerRadius={innerRadius}
        innerCircleColor={T.bg}
        strokeWidth={2}
        strokeColor={T.bg}
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
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingVertical: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  centerValue: {
    ...textValue,
  },
  centerSub: {
    marginTop: 4,
    ...textCaption,
  },
});
