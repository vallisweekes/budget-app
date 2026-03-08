import React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line as SvgLine, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import type { useDebtScreenController } from "@/lib/hooks/useDebtScreenController";
import { debtStyles as styles } from "@/screens/debt/styles";
import { projectionMonthLabel } from "@/screens/debt/utils";

type DebtScreenController = ReturnType<typeof useDebtScreenController>;

export function DebtProjectionCard({ controller }: { controller: DebtScreenController }) {
  const { projectionSummary } = controller;
  if (projectionSummary.months <= 1) return null;

  const chartHeight = 180;
  const paddingLeft = 0;
  const paddingRight = 0;
  const paddingTop = 44;
  const paddingBottom = 32;

  const toX = (index: number) => paddingLeft + (index / Math.max(1, projectionSummary.months)) * (controller.chartWidth - paddingLeft - paddingRight);
  const toY = (value: number) => paddingTop + (1 - (projectionSummary.total > 0 ? value / projectionSummary.total : 0)) * (chartHeight - paddingTop - paddingBottom);

  const smoothPath = (() => {
    if (projectionSummary.projection.length < 2) return "";
    const points = projectionSummary.projection.map((value, index) => ({ x: toX(index), y: toY(value) }));
    let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const controlPointX = (previous.x + current.x) / 2;
      path += ` C${controlPointX.toFixed(1)},${previous.y.toFixed(1)} ${controlPointX.toFixed(1)},${current.y.toFixed(1)} ${current.x.toFixed(1)},${current.y.toFixed(1)}`;
    }
    return path;
  })();

  const lastPoint = projectionSummary.projection.length > 0
    ? { x: toX(projectionSummary.months), y: toY(0) }
    : null;
  const areaPath = smoothPath + (lastPoint ? ` L${lastPoint.x.toFixed(1)},${(chartHeight - paddingBottom).toFixed(1)} L${toX(0).toFixed(1)},${(chartHeight - paddingBottom).toFixed(1)} Z` : "");
  const tipX = toX(projectionSummary.selectedMonth);
  const tipY = toY(projectionSummary.selectedValue);
  const tipValue = fmt(projectionSummary.selectedValue, controller.currency);
  const tipPillWidth = Math.max(80, tipValue.length * 9 + 20);
  const tipPillHeight = 28;
  const tipPillX = Math.min(Math.max(tipX - tipPillWidth / 2, 4), controller.chartWidth - tipPillWidth - 4);
  const tipPillY = tipY - tipPillHeight - 10;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Debt Payoff Projection</Text>
          <Text style={styles.chartSub}>
            {projectionSummary.monthsToClear != null ? `Debt-free by ${projectionSummary.payoffLabel}` : "No payoff projected"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={controller.onOpenAnalytics} style={styles.analyticsBtn}>
            <Text style={styles.analyticsBtnTxt}>Analytics</Text>
            <Ionicons name="chevron-forward" size={12} color={T.accent} />
          </Pressable>
          <View style={styles.chartBadge}>
            <Text style={styles.chartBadgeTxt}>{projectionSummary.months}mo</Text>
          </View>
        </View>
      </View>

      <View onLayout={(event) => controller.setChartWidth(event.nativeEvent.layout.width)} style={{ height: chartHeight, width: "100%" }}>
        <Svg width={controller.chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={T.accent} stopOpacity="0.22" />
              <Stop offset="1" stopColor={T.accent} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#debtGrad)" />
          <Path d={smoothPath} stroke={T.accent} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <SvgLine x1={tipX} y1={tipPillY + tipPillHeight} x2={tipX} y2={tipY - 10} stroke={T.accent} strokeWidth={1} strokeDasharray="2,2" strokeOpacity="0.5" />
          <Rect x={tipPillX} y={tipPillY} width={tipPillWidth} height={tipPillHeight} rx={8} fill={T.text} />
          <SvgText x={tipPillX + tipPillWidth / 2} y={tipPillY + 18} fontSize={12} fill={T.bg} textAnchor="middle" fontWeight="800">{tipValue}</SvgText>
          <Circle cx={tipX} cy={tipY} r={5} fill={T.card} stroke={T.accent} strokeWidth={2} />
          <Circle cx={tipX} cy={tipY} r={2.5} fill={T.accent} />

          {projectionSummary.milestoneMonths.map((month) => (
            <G key={`m-${month}`}>
              <SvgLine x1={toX(month)} y1={chartHeight - paddingBottom} x2={toX(month)} y2={chartHeight - paddingBottom - 5} stroke={T.border} strokeWidth={1} />
              <Circle
                cx={toX(month)}
                cy={toY(projectionSummary.projection[month] ?? 0)}
                r={projectionSummary.selectedMonth === month ? 3.8 : 3}
                fill={projectionSummary.selectedMonth === month ? T.accent : T.accentDim}
                stroke={T.accent}
                strokeWidth={1}
              />
            </G>
          ))}

          <Circle cx={toX(projectionSummary.months)} cy={toY(0)} r={4} fill={T.green} />
          <SvgLine x1={toX(0)} y1={chartHeight - paddingBottom} x2={toX(projectionSummary.months)} y2={chartHeight - paddingBottom} stroke={T.border} strokeWidth={1} />
          <SvgText x={toX(0) + 2} y={chartHeight - 10} fontSize={10} fill={T.textMuted} textAnchor="start" fontWeight="600">Now</SvgText>
          {projectionSummary.milestoneMonths.map((month) => (
            <SvgText key={`lbl-${month}`} x={toX(month)} y={chartHeight - 10} fontSize={10} fill={T.textMuted} textAnchor="middle" fontWeight="600">
              {projectionMonthLabel(month)}
            </SvgText>
          ))}
          <SvgText x={toX(projectionSummary.months) - 2} y={chartHeight - 10} fontSize={10} fill={T.green} textAnchor="end" fontWeight="700">{projectionSummary.payoffLabel}</SvgText>
        </Svg>
      </View>

      {projectionSummary.milestoneMonths.length > 0 ? (
        <View style={styles.milestoneRow}>
          <Text style={styles.milestoneLabel}>Tap point:</Text>
          {projectionSummary.milestoneMonths.map((month) => (
            <Pressable
              key={`chip-${month}`}
              onPress={() => controller.setSelectedProjectionMonth(month)}
              style={[styles.milestoneChip, projectionSummary.selectedMonth === month && styles.milestoneChipActive]}
            >
              <Text style={[styles.milestoneChipText, projectionSummary.selectedMonth === month && styles.milestoneChipTextActive]}>
                {month === 12 ? "1 year" : month === 24 ? "2 years" : `${month} months`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.chipRow}>
        {projectionSummary.highestAPR ? (
          <View style={[styles.chip, { borderColor: `${T.red}55` }]}>
            <Ionicons name="flame-outline" size={13} color={T.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.chipLabel}>HIGHEST APR</Text>
              <Text style={styles.chipValue} numberOfLines={1}>
                {projectionSummary.highestAPR.displayTitle ?? projectionSummary.highestAPR.name} · {projectionSummary.highestAPR.interestRate}%
              </Text>
            </View>
          </View>
        ) : null}
        <View style={[styles.chip, { borderColor: `${T.green}55` }]}>
          <Ionicons name="time-outline" size={13} color={T.green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.chipLabel}>SELECTED POINT</Text>
            <Text style={styles.chipValue}>{fmt(projectionSummary.selectedValue, controller.currency)} at {projectionSummary.selectedMonth}mo</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default DebtProjectionCard;