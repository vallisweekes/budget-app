import React from "react";
import { Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

import { useAppTranslation } from "@/hooks";
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

function PointerSelectionReporter({
  items,
  onChange,
}: {
  items: AnalyticsOverviewPointerItem[];
  onChange: (index: number) => void;
}) {
  const focusedIndex = React.useMemo(() => {
    const item = items?.[0];
    return typeof item?.index === "number" && Number.isFinite(item.index) ? item.index : null;
  }, [items]);

  React.useEffect(() => {
    if (focusedIndex === null) return;
    onChange(focusedIndex);
  }, [focusedIndex, onChange]);

  return null;
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
  const { t } = useAppTranslation();
  const incomeColor = "#4da2ff";
  const expenseColor = "#ff5ca8";
  const lastSelectableIndex = Math.max(0, chartData.labels.length - 1);
  const [selectedIndex, setSelectedIndex] = React.useState(lastSelectableIndex);
  const chartRenderWidth = Math.max(240, chartWidth - 2);
  const chartRenderSpacing = React.useMemo(() => {
    if (overviewMode !== "year") return chartSpacing;
    const points = Math.max(2, chartData.labels.length);
    const usable = Math.max(176, chartRenderWidth - 22);
    return Math.max(11, Math.floor(usable / (points - 1)) - 1);
  }, [chartData.labels.length, chartRenderWidth, chartSpacing, overviewMode]);

  const visualYAxisLabels = React.useMemo(() => {
    const sections = 5;
    const step = overviewMaxValue / sections;
    return Array.from({ length: sections + 1 }, (_, index) => formatCompactAxisValue(step * (sections - index)));
  }, [overviewMaxValue]);

  React.useEffect(() => {
    setSelectedIndex(lastSelectableIndex);
  }, [lastSelectableIndex, overviewMode]);

  const selectedSummary = React.useMemo(() => {
    const safeIndex = Math.min(Math.max(selectedIndex, 0), lastSelectableIndex);
    return {
      label: chartData.rawLabels[safeIndex] ?? chartData.labels[safeIndex] ?? currentMonthLabel,
      income: incomeLine[safeIndex]?.value ?? chartData.incomeSeries[safeIndex] ?? 0,
      expense: expenseLine[safeIndex]?.value ?? chartData.expenseSeries[safeIndex] ?? 0,
    };
  }, [chartData.expenseSeries, chartData.incomeSeries, chartData.labels, chartData.rawLabels, currentMonthLabel, expenseLine, incomeLine, lastSelectableIndex, selectedIndex]);

  return (
    <View style={s.overviewHero}>
      <View
        style={s.overviewFlatChartWrap}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          if (width > 0 && Math.abs(width - overviewWrapWidth) > 1) {
            onWrapWidthChange(width);
          }
        }}
      >
        <View style={s.overviewPinnedSummary}>
          <Text style={s.overviewPinnedSummaryLabel}>{selectedSummary.label}</Text>
          <View style={s.overviewPinnedSummaryMetricRow}>
            <View style={[s.overviewPinnedSummaryDot, { backgroundColor: incomeColor }]} />
            <Text style={s.overviewPinnedSummaryMetricName}>{t("analytics.overview.income")}</Text>
            <Text style={s.overviewPinnedSummaryMetricValue}>{fmt(selectedSummary.income, currency)}</Text>
          </View>
          <View style={s.overviewPinnedSummaryMetricRow}>
            <View style={[s.overviewPinnedSummaryDot, { backgroundColor: expenseColor }]} />
            <Text style={s.overviewPinnedSummaryMetricName}>{t("analytics.overview.expenses")}</Text>
            <Text style={s.overviewPinnedSummaryMetricValue}>{fmt(selectedSummary.expense, currency)}</Text>
          </View>
        </View>
        <View style={s.overviewPlotWrap}>
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
            color1={incomeColor}
            color2={expenseColor}
            thickness={3}
            thickness2={2.5}
            height={OVERVIEW_CHART_H}
            width={chartRenderWidth}
            initialSpacing={10}
            endSpacing={8}
            spacing={chartRenderSpacing}
            noOfSections={5}
            maxValue={overviewMaxValue}
            yAxisLabelWidth={2}
            yAxisColor="transparent"
            xAxisColor={T.border}
            yAxisTextStyle={[s.chartAxisText, { color: "transparent" }]}
            xAxisLabelTextStyle={s.chartAxisXText}
            rulesColor="rgba(244,246,255,0.10)"
            rulesType="dashed"
            hideDataPoints={false}
            dataPointsColor={incomeColor}
            dataPointsColor2={expenseColor}
            dataPointsRadius={4}
            dataPointsRadius2={4}
            areaChart
            startFillColor={incomeColor}
            endFillColor={incomeColor}
            startOpacity={0.18}
            endOpacity={0.02}
            pointerConfig={{
              activatePointersInstantlyOnTouch: true,
              pointerVanishDelay: 0,
              resetPointerIndexOnRelease: false,
              autoAdjustPointerLabelPosition: true,
              pointerStripColor: incomeColor,
              pointerStripWidth: 1,
              strokeDashArray: [4, 4],
              pointerColor: incomeColor,
              radius: 4,
              pointerLabelWidth: 1,
              pointerLabelHeight: 1,
              pointerLabelComponent: (items: AnalyticsOverviewPointerItem[]) => (
                <PointerSelectionReporter items={items} onChange={setSelectedIndex} />
              ),
            }}
          />
        </View>
      </View>

      <View style={s.overviewLegendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: incomeColor }]} />
          <Text style={s.legendText}>{t("analytics.overview.income")}</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: expenseColor }]} />
          <Text style={s.legendText}>{t("analytics.overview.expenses")}</Text>
        </View>
      </View>
    </View>
  );
}