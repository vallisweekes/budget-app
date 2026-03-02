import React, { useMemo } from "react";
import { Dimensions, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { T } from "@/lib/theme";
import { computeBudgetDonutMetrics, getBudgetDonutSize } from "@/lib/domain/budgetDonut";
import type { BudgetDonutCardProps } from "@/types";
import { styles } from "./styles";

// Arc colours — high contrast for quick scan
const COLOR_REMAINING = T.accent; // left to spend
const COLOR_COMMITTED = T.orange; // committed (not yet paid)
const COLOR_PAID = T.green; // already paid

const W = Dimensions.get("window").width;

export default function BudgetDonutCard({ totalBudget, totalExpenses, paidTotal, currency, fmt }: BudgetDonutCardProps) {
  const { remaining, isOverBudget, paidFrac, committedFrac, hasData } = useMemo(
    () => computeBudgetDonutMetrics(totalBudget, totalExpenses, paidTotal),
    [paidTotal, totalBudget, totalExpenses],
  );

  if (!hasData) return null;

  // Chart geometry
  const SIZE    = getBudgetDonutSize(W);
  const cx      = SIZE / 2;
  const cy      = SIZE / 2;
  const STROKE  = Math.round(SIZE * 0.135);
  const r       = (SIZE - STROKE) / 2;
  const C       = 2 * Math.PI * r; // full circumference

  const paidLen      = paidFrac      * C;
  const committedLen = committedFrac * C;

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
          {/* Remaining arc (track) — blue */}
          <Circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={isOverBudget ? "rgba(150,150,180,0.15)" : COLOR_REMAINING}
            strokeWidth={STROKE}
          />

          {/* Committed spending arc — starts where paid arc ends */}
          {committedFrac > 0.005 && (
            <Circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={COLOR_COMMITTED}
              strokeWidth={STROKE}
              strokeDasharray={`${committedLen} ${C}`}
              strokeDashoffset={-paidLen}
              strokeLinecap="round"
              rotation={-90}
              originX={cx}
              originY={cy}
            />
          )}

          {/* Paid arc — drawn on top so its round caps overlap cleanly */}
          {paidFrac > 0.005 && (
            <Circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={COLOR_PAID}
              strokeWidth={STROKE}
              strokeDasharray={`${paidLen} ${C}`}
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
    </View>
  );
}
