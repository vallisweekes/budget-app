import React, { useMemo } from "react";
import { Dimensions, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { T } from "@/lib/theme";
import { computeBudgetDonutMetrics, getBudgetDonutSize } from "@/lib/domain/budgetDonut";
import type { BudgetDonutCardProps } from "@/types";
import { styles } from "./styles";

// Arc colours — high contrast for quick scan
const COLOR_TRACK = "rgba(255,255,255,0.09)";
const COLOR_REMAINING = T.accent; // left to spend
const COLOR_USED = T.green; // budget already used
const COLOR_OVERSPEND = T.red;
const MIN_VISIBLE_REMAINING_MARKER_FRAC = 0.08;

const W = Dimensions.get("window").width;

export default function BudgetDonutCard({ totalBudget, totalExpenses, paidTotal, currency, fmt }: BudgetDonutCardProps) {
  const {
    remaining,
    isOverBudget,
    usedWithinBudget,
    remainingBudget,
    overspend,
    usedFrac,
    remainingFrac,
    overspendFrac,
  } = useMemo(
    () => computeBudgetDonutMetrics(totalBudget, totalExpenses, paidTotal),
    [paidTotal, totalBudget, totalExpenses],
  );

  // Chart geometry
  const SIZE    = getBudgetDonutSize(W);
  const cx      = SIZE / 2;
  const cy      = SIZE / 2;
  const STROKE  = Math.round(SIZE * 0.135);
  const r       = (SIZE - STROKE) / 2;
  const C       = 2 * Math.PI * r; // full circumference
  const outerR  = r + STROKE * 0.68;
  const outerC  = 2 * Math.PI * outerR;

  const usedLen      = usedFrac      * C;
  const remainingLen = remainingFrac * C;
  const overspendLen = overspendFrac * outerC;
  const remainingOffset = -usedLen;
  const shouldShowRemainingMarker = !isOverBudget && remainingFrac > 0 && remainingFrac < MIN_VISIBLE_REMAINING_MARKER_FRAC;
  const markerRadius = Math.max(6, Math.round(STROKE * 0.18));
  const markerCx = cx;
  const markerCy = cy - r;

  const centerKicker = isOverBudget ? "Over budget" : "Remaining";
  const centerTop = isOverBudget ? fmt(Math.abs(remaining), currency) : fmt(remaining, currency);
  const centerSub = isOverBudget
    ? `Budget ${fmt(totalBudget, currency)}`
    : `of ${fmt(totalBudget, currency)} budget`;

  return (
    <View style={styles.card}>
      {/* ── Donut ring ── */}
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          {/* Base track */}
          <Circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={COLOR_TRACK}
            strokeWidth={STROKE}
          />

          {/* Remaining arc */}
          {remainingFrac > 0.005 && (
            <Circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={COLOR_REMAINING}
              strokeWidth={STROKE}
              strokeDasharray={`${remainingLen} ${C}`}
              strokeDashoffset={remainingOffset}
              strokeLinecap="round"
              rotation={-90}
              originX={cx}
              originY={cy}
            />
          )}

          {shouldShowRemainingMarker ? (
            <Circle
              cx={markerCx}
              cy={markerCy}
              r={markerRadius}
              fill={COLOR_REMAINING}
              stroke={T.bg}
              strokeWidth={Math.max(2, Math.round(markerRadius * 0.45))}
            />
          ) : null}

          {/* Used arc */}
          {usedFrac > 0.005 && (
            <Circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={COLOR_USED}
              strokeWidth={STROKE}
              strokeDasharray={`${usedLen} ${C}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              rotation={-90}
              originX={cx}
              originY={cy}
            />
          )}

          {/* Overspend ring: shows how far beyond budget current spending has gone */}
          {isOverBudget ? (
            <Circle
              cx={cx} cy={cy} r={outerR}
              fill="none"
              stroke="rgba(226,92,92,0.18)"
              strokeWidth={Math.max(6, Math.round(STROKE * 0.3))}
            />
          ) : null}

          {isOverBudget && overspendFrac > 0.005 ? (
            <Circle
              cx={cx} cy={cy} r={outerR}
              fill="none"
              stroke={COLOR_OVERSPEND}
              strokeWidth={Math.max(6, Math.round(STROKE * 0.3))}
              strokeDasharray={`${overspendLen} ${outerC}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              rotation={-90}
              originX={cx}
              originY={cy}
            />
          ) : null}
        </Svg>

        {/* Center label */}
        <View style={[styles.centerWrap, { width: SIZE, height: SIZE }]}>
          <Text style={[styles.centerKicker, isOverBudget && { color: T.red }]}>{centerKicker}</Text>
          <Text
            style={[styles.centerValue, isOverBudget && { color: T.red }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {centerTop}
          </Text>
          <Text style={styles.centerSub}>{centerSub}</Text>
        </View>
      </View>

      <View style={styles.legendRow}>
        <LegendChip label="Used" value={fmt(usedWithinBudget, currency)} color={COLOR_USED} />
        <LegendChip label={isOverBudget ? "Over" : "Left"} value={fmt(isOverBudget ? overspend : remainingBudget, currency)} color={isOverBudget ? COLOR_OVERSPEND : COLOR_REMAINING} />
      </View>
    </View>
  );
}

function LegendChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.legendChip}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}
