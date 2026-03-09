import React, { useMemo } from "react";
import { View, Text, Dimensions } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import type { CategorySpendingChartProps } from "@/types";

const W = Dimensions.get("window").width;

const FALLBACK_COLORS = ["#0f282f", "#3ec97e", "#e25c5c", "#f4a942", "#38bdf8", "#a78bfa"];

export default function CategorySpendingChart({ categories, currency, fmt }: CategorySpendingChartProps) {
  const { data, totalShown } = useMemo(() => {
    const sorted = (categories ?? [])
      .filter((c) => (c.total ?? 0) > 0)
      .slice()
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .slice(0, 6);

    const chartData = sorted.map((c, i) => {
      return {
        id: c.id,
        value: c.total ?? 0,
        color: c.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        name: c.name,
      };
    });

    const sum = chartData.reduce((acc, d) => acc + (d.value ?? 0), 0);

    return {
      data: chartData,
      totalShown: sum,
    };
  }, [categories]);

  if (data.length === 0) return null;

  const radius = Math.min(92, Math.max(72, Math.floor((W - 64) / 3.4)));
  const innerRadius = Math.floor(radius * 0.62);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Spending</Text>
        <Text style={styles.total}>{fmt(totalShown, currency)}</Text>
      </View>

      <PieChart
        data={data.map((d) => ({ value: d.value, color: d.color }))}
        donut
        radius={radius}
        innerRadius={innerRadius}
        innerCircleColor={T.card}
        strokeWidth={2}
        strokeColor={T.card}
        showText={false}
        focusOnPress={false}
        isAnimated
        animationDuration={500}
        centerLabelComponent={() => (
          <View style={{ alignItems: "center" }}>
            <Text style={styles.centerTop}>Total</Text>
            <Text style={styles.centerValue}>{fmt(totalShown, currency)}</Text>
          </View>
        )}
      />

      <View style={styles.legend}>
        {data.map((d) => {
          const label = d.name.length > 18 ? `${d.name.slice(0, 18)}…` : d.name;
          return (
            <View key={d.id} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: d.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.legendValue}>{fmt(d.value, currency)}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.caption}>Top categories</Text>
    </View>
  );
}
