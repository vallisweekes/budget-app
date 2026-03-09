import React from "react";
import { Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

import { fmt } from "@/lib/formatting";
import { OVERVIEW_CHART_H } from "@/lib/helpers/analytics";
import { T } from "@/lib/theme";
import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";
import type { AnalyticsOverviewCardProps, AnalyticsOverviewPointerItem } from "@/types";

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
        <LineChart
          data={incomeLine}
          data2={expenseLine}
          curved
          color1="#2c91ff"
          color2="#ef4fa6"
          thickness={2}
          thickness2={2}
          height={OVERVIEW_CHART_H}
          width={chartWidth}
          initialSpacing={0}
          endSpacing={0}
          spacing={chartSpacing}
          noOfSections={5}
          maxValue={overviewMaxValue}
          yAxisColor={T.border}
          xAxisColor={T.border}
          yAxisTextStyle={s.chartAxisText}
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
              const index = Number.isFinite(item.index) ? item.index : 0;
              const monthLabel = chartData.rawLabels[index] ?? chartData.labels[index] ?? "";
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