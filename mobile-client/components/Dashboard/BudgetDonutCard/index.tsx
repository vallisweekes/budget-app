import React, { useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";
import { computeBudgetDonutMetrics } from "@/lib/domain/budgetDonut";
import type { BudgetDonutCardProps } from "@/types";
import { styles } from "./styles";

const SIZE = 228;
const STROKE = 32;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const COLOR_TRACK = "rgba(255,255,255,0.07)";
const COLOR_LEFT = T.accent;
const COLOR_USED = T.green;
const COLOR_OVERSPEND = T.red;
const MIN_VISIBLE_LEFT_FRAC = 0.12;

export default function BudgetDonutCard({ totalBudget, totalExpenses, paidTotal, currency, fmt, periodLabel }: BudgetDonutCardProps) {
  const { t } = useAppTranslation();
  const {
    remaining,
    isOverBudget,
    usedWithinBudget,
    usedFrac,
    remainingFrac,
    overspend,
  } = useMemo(
    () => computeBudgetDonutMetrics(totalBudget, totalExpenses, paidTotal),
    [paidTotal, totalBudget, totalExpenses],
  );

  const visibleLeftFrac = !isOverBudget && remainingFrac > 0 && remainingFrac < MIN_VISIBLE_LEFT_FRAC
    ? MIN_VISIBLE_LEFT_FRAC
    : remainingFrac;
  const visibleUsedFrac = !isOverBudget && remainingFrac > 0 && remainingFrac < MIN_VISIBLE_LEFT_FRAC
    ? Math.max(0, 1 - visibleLeftFrac)
    : usedFrac;
  const usedLength = visibleUsedFrac * CIRCUMFERENCE;
  const leftLength = visibleLeftFrac * CIRCUMFERENCE;
  const leftOffset = -usedLength;

  const heroTitle = periodLabel ?? t("dashboard.budgetOverview");
  const centerTitle = periodLabel ?? (isOverBudget ? t("dashboard.overBudget") : t("dashboard.budgetRemaining"));
  const centerTop = isOverBudget ? fmt(Math.abs(remaining), currency) : fmt(Math.max(0, remaining), currency);
  const centerSub = t("dashboard.ofBudget", { amount: fmt(totalBudget, currency) });

  return (
    <View style={styles.wrap}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{heroTitle}</Text>

        <View style={styles.chartShell}>
          <View style={styles.chartHalo} />
          <View style={styles.chartWrap}>
            <Svg width={SIZE} height={SIZE}>
              <Circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={COLOR_TRACK}
                strokeWidth={STROKE}
                rotation={-90}
                originX={CX}
                originY={CY}
              />

              {isOverBudget ? (
                <Circle
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke={COLOR_OVERSPEND}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                />
              ) : null}

              {!isOverBudget && visibleUsedFrac > 0.005 ? (
                <Circle
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke={COLOR_USED}
                  strokeWidth={STROKE}
                  strokeDasharray={`${usedLength} ${CIRCUMFERENCE}`}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  rotation={-90}
                  originX={CX}
                  originY={CY}
                />
              ) : null}

              {!isOverBudget && visibleLeftFrac > 0.005 ? (
                <Circle
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke={COLOR_LEFT}
                  strokeWidth={STROKE}
                  strokeDasharray={`${leftLength} ${CIRCUMFERENCE}`}
                  strokeDashoffset={leftOffset}
                  strokeLinecap="round"
                  rotation={-90}
                  originX={CX}
                  originY={CY}
                />
              ) : null}
            </Svg>

            <View style={styles.centerLabel} pointerEvents="none">
              <Text style={styles.centerTitle}>{centerTitle}</Text>
              <Text
                style={[styles.centerValue, !isOverBudget && styles.centerValuePositive, isOverBudget && styles.centerValueOver]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {centerTop}
              </Text>
              <Text style={styles.centerSub}>{centerSub}</Text>
            </View>
          </View>
        </View>

        <View style={styles.legendRow}>
          {isOverBudget ? (
            <LegendChip label={t("dashboard.legendOver")} value={fmt(overspend, currency)} color={COLOR_OVERSPEND} />
          ) : (
            <>
              <LegendChip label={t("dashboard.legendSpent")} value={fmt(usedWithinBudget, currency)} color={COLOR_USED} />
              <LegendChip label={t("dashboard.legendLeft")} value={fmt(Math.max(0, remaining), currency)} color={COLOR_LEFT} />
            </>
          )}
        </View>
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
