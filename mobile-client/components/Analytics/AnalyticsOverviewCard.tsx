import React from "react";
import { Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

import { fmt } from "@/lib/formatting";
import { OVERVIEW_CHART_H } from "@/lib/helpers/analytics";
import { T } from "@/lib/theme";
import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";
import type { AnalyticsOverviewCardProps, AnalyticsOverviewPointerItem } from "@/types";

function formatCompactAxisValue(value: number) {
  if (!Number.isFinite(value)) return "0";
  const absolute = Math.abs(value);
  if (absolute < 1000) return String(Math.round(value));
  if (absolute < 1_000_000) {
    const compact = (value / 1000).toFixed(1).replace(/\.0$/, "");
    return `${compact}k`;
  }
  const compact = (value / 1_000_000).toFixed(1).replace(/\.0$/, "");
  return `${compact}m`;
}

export default function AnalyticsOverviewCard({
  chartData,
  chartSpacing,
  chartWidth,
  currency,
  currentMonthLabel,
  expenseLine,
  incomeLine,
  onWrapWidthChange,
  overviewMaxValue,
  overviewMode,
  overviewWrapWidth,
}: AnalyticsOverviewCardProps) {
  const chartRenderWidth = Math.max(220, chartWidth - 28);

  const visualYAxisLabels = React.useMemo(() => {
    const sections = 5;
    const step = overviewMaxValue / sections;
    return Array.from({ length: sections + 1 }, (_, index) => formatCompactAxisValue(step * (sections - index)));
  }, [overviewMaxValue]);

  return (
    <View style={s.tipCard}>
      <View style={s.overviewHead}>
        <Text style={s.tipTitle}>Overview</Text>
        <Text style={s.overviewModeBadge}>{overviewMode === "year" ? "Yearly view" : `${currentMonthLabel} snapshot`}</Text>
      </View>

      <View
        style={s.overviewChartWrap}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          if (width > 0 && Math.abs(width - overviewWrapWidth) > 1) {
            onWrapWidthChange(width);
          }
        }}
      >
        <View pointerEvents="none" style={s.overviewYAxisOverlay}>
          {visualYAxisLabels.map((label) => (
            <Text key={label} style={s.overviewYAxisLabel}>
              {label}
            </Text>
          ))}
        </View>
        <LineChart
          data={incomeLine}
          data2={expenseLine}
          curved
          color1="#2c91ff"
          color2="#ef4fa6"
          thickness={2}
          thickness2={2}
          height={OVERVIEW_CHART_H}
          width={chartRenderWidth}
          initialSpacing={10}
          endSpacing={24}
          spacing={chartSpacing}
          noOfSections={5}
          maxValue={overviewMaxValue}
          yAxisLabelWidth={24}
          yAxisColor="transparent"
          xAxisColor={T.border}
          yAxisTextStyle={[s.chartAxisText, { color: "transparent" }]}
          xAxisLabelTextStyle={s.chartAxisXText}
          rulesColor={T.border}
          rulesType="dashed"
          hideDataPoints={false}
          dataPointsColor="#2c91ff"
          dataPointsColor2="#ef4fa6"
          dataPointsRadius={3}
          dataPointsRadius2={3}
          areaChart
          startFillColor="#2c91ff"
          endFillColor="#2c91ff"
          startOpacity={0.16}
          endOpacity={0.02}
          pointerConfig={{
            activatePointersOnLongPress: true,
            autoAdjustPointerLabelPosition: true,
            pointerStripColor: "#2c91ff",
            pointerStripWidth: 1,
            strokeDashArray: [4, 4],
            pointerColor: "#2c91ff",
            radius: 4,
            pointerLabelWidth: 128,
            pointerLabelHeight: 64,
            pointerLabelComponent: (items: AnalyticsOverviewPointerItem[]) => {
              const item = items?.[0];
              if (!item) return null;
              const safeIndex = typeof item.index === "number" && Number.isFinite(item.index) ? item.index : 0;
              const monthLabel = item.rawLabel ?? item.label ?? chartData.rawLabels[safeIndex] ?? chartData.labels[safeIndex] ?? "";
              return (
                <View style={s.pointerTooltip}>
                  <Text style={s.pointerTooltipValue}>{fmt(item.value ?? 0, currency)}</Text>
                  <Text style={s.pointerTooltipMonth}>{monthLabel}</Text>
                </View>
              );
            },
          }}
        />
      </View>

      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: "#2c91ff" }]} />
          <Text style={s.legendText}>Income</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: "#ef4fa6" }]} />
          <Text style={s.legendText}>Expenses</Text>
        </View>
      </View>
    </View>
  );
}