import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import type { DashboardCategoryItem } from "@/lib/apiTypes";
import { T } from "@/lib/theme";

interface Props {
  categories: DashboardCategoryItem[];
  currency: string;
  fmt: (v: number | string | null | undefined, c: string) => string;
}

const W = Dimensions.get("window").width;

const FALLBACK_COLORS = ["#0f282f", "#3ec97e", "#e25c5c", "#f4a942", "#38bdf8", "#a78bfa"];

export default function CategorySpendingChart({ categories, currency, fmt }: Props) {
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
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>Spending</Text>
        <Text style={s.total}>{fmt(totalShown, currency)}</Text>
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
            <Text style={s.centerTop}>Total</Text>
            <Text style={s.centerValue}>{fmt(totalShown, currency)}</Text>
          </View>
        )}
      />

      <View style={s.legend}>
        {data.map((d) => {
          const label = d.name.length > 18 ? `${d.name.slice(0, 18)}…` : d.name;
          return (
            <View key={d.id} style={s.legendRow}>
              <View style={[s.dot, { backgroundColor: d.color }]} />
              <Text style={s.legendLabel} numberOfLines={1}>
                {label}
              </Text>
              <Text style={s.legendValue}>{fmt(d.value, currency)}</Text>
            </View>
          );
        })}
      </View>

      <Text style={s.caption}>Top categories</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: T.card,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    borderWidth: 2,
    borderColor: T.accentBorder,
    alignItems: "center",
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  total: {
    color: T.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  caption: {
    marginTop: 8,
    color: T.textDim,
    fontSize: 12,
    fontWeight: "600",
  },
  centerTop: {
    color: T.textDim,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  centerValue: {
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  legend: {
    width: "100%",
    marginTop: 12,
    gap: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginRight: 8,
  },
  legendValue: {
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
  },
});
