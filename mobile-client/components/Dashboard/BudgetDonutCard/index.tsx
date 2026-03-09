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
const MIN_VISIBLE_REMAINING_FRAC = 0.12;

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

  const visibleRemainingFrac = !isOverBudget && remainingFrac > 0 && remainingFrac < MIN_VISIBLE_REMAINING_FRAC
    ? MIN_VISIBLE_REMAINING_FRAC
    : remainingFrac;
  const visibleUsedFrac = !isOverBudget && remainingFrac > 0 && remainingFrac < MIN_VISIBLE_REMAINING_FRAC
    ? Math.max(0, 1 - visibleRemainingFrac)
    : usedFrac;
  const visibleUsedLen = visibleUsedFrac * C;
  const remainingLen = visibleRemainingFrac * C;
  const remainingOffset = -visibleUsedLen;

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

          {isOverBudget ? (
            <Circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={COLOR_OVERSPEND}
              strokeWidth={STROKE}
            />
          ) : null}

          {/* Remaining arc */}
          {!isOverBudget && remainingFrac > 0.005 && (
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

          {/* Used arc */}
          {!isOverBudget && visibleUsedFrac > 0.005 && (
            <Circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={COLOR_USED}
              strokeWidth={STROKE}
              strokeDasharray={`${visibleUsedLen} ${C}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              rotation={-90}
              originX={cx}
              originY={cy}
            />
          )}

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
        {isOverBudget ? (
          <LegendChip label="Over" value={fmt(overspend, currency)} color={COLOR_OVERSPEND} />
        ) : (
          <>
            <LegendChip label="Used" value={fmt(usedWithinBudget, currency)} color={COLOR_USED} />
            <LegendChip label="Left" value={fmt(remainingBudget, currency)} color={COLOR_REMAINING} />
          </>
        )}
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
