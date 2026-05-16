import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Dimensions } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import type { IncomeBarChartProps } from "@/types";

const W = Dimensions.get("window").width;
const TOOLTIP_SLOT_HEIGHT = 158;

export default function IncomeBarChart({ data: a, currency }: IncomeBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [didUserSelectPoint, setDidUserSelectPoint] = useState(false);
  const additionalPlansExpenses = Math.max(0, Number(a.expenseBreakdown?.additionalPlansExpenses) || 0);
  const selectedPlanExpenses = Math.max(0, Number(a.expenseBreakdown?.selectedPlanExpenses) || 0);

  const chartPoints = useMemo(() => {
    const points: Array<{ key: string; label: string; color: string; value: number }> = [
      {
        key: "selectedPlanExpenses",
        label: additionalPlansExpenses > 0 ? "This plan" : "Expenses",
        color: T.red,
        value: additionalPlansExpenses > 0 ? selectedPlanExpenses : Math.max(0, Number(a.plannedExpenses) || 0),
      },
    ];

    if (additionalPlansExpenses > 0) {
      points.push({
        key: "additionalPlansExpenses",
        label: "Other plan",
        color: "#ff8aa0",
        value: additionalPlansExpenses,
      });
    }

    points.push(
      {
        key: "plannedDebtPayments",
        label: "Debts",
        color: T.orange,
        value: Math.max(0, Number(a.plannedDebtPayments) || 0),
      },
      {
        key: "incomeSacrifice",
        label: "Sacrifice",
        color: T.accent,
        value: Math.max(0, Number(a.incomeSacrifice) || 0),
      }
    );

    return points;
  }, [a.incomeSacrifice, a.plannedDebtPayments, a.plannedExpenses, additionalPlansExpenses, selectedPlanExpenses]);

  const values = useMemo(() => chartPoints.map((point) => point.value), [chartPoints]);
  const highestIndex = useMemo(
    () => values.reduce((bestIdx, value, index) => (value > values[bestIdx] ? index : bestIdx), 0),
    [values]
  );

  useEffect(() => {
    if (didUserSelectPoint) return;
    setActiveIndex(highestIndex);
  }, [didUserSelectPoint, highestIndex]);

  const totalIncome = Number(a.grossIncome) || 0;
  const maxVal = Math.max(1, totalIncome);

  const chartW = W - 56;
  const chartH = 182;
  const leftPad = 42;
  const rightPad = 12;
  const topPad = 10;
  const bottomPad = 38;
  const plotW = chartW - leftPad - rightPad;
  const plotH = chartH - topPad - bottomPad;
  const pointInset = 16;
  const plotInnerW = Math.max(1, plotW - pointInset * 2);

  const yValue = (v: number) => topPad + plotH - (v / maxVal) * plotH;

  const points = useMemo(() => values.map((value, index) => {
    const x = leftPad + pointInset + (plotInnerW * index) / Math.max(1, values.length - 1);
    const y = yValue(value);
    return { x, y, value };
  }), [values, leftPad, plotInnerW]);

  const curvePath = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1]!;
    const cpx = (prev.x + point.x) / 2;
    return `${path} C ${cpx} ${prev.y}, ${cpx} ${point.y}, ${point.x} ${point.y}`;
  }, "");

  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => {
    const value = maxVal * ratio;
    const y = yValue(value);
    return { ratio, value, y };
  });

  const fmtAxis = (n: number) => {
    if (n >= 1000) return `${currency}${Math.round(n / 1000)}k`;
    return `${currency}${Math.round(n)}`;
  };

  const fmtAmount = (n: number) => {
    const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
    return `${currency}${rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const activeMetric = activeIndex !== null ? chartPoints[activeIndex] : null;
  const activeExpensePreview = activeMetric?.key === "selectedPlanExpenses"
    ? a.expenseBreakdown?.selectedPlanPreview
    : activeMetric?.key === "additionalPlansExpenses"
      ? a.expenseBreakdown?.additionalPlansPreview
      : null;
  const plannedDebtPayable = Math.max(0, Number(a.plannedDebtPayments) || 0);
  const showExpenseTooltipPreview = Boolean(activeExpensePreview?.items.length);
  const showDebtPayableLine = activeMetric?.key === "plannedDebtPayments";

  const tooltipW = showExpenseTooltipPreview ? 212 : 174;
  const tooltipH = showExpenseTooltipPreview
    ? 56 + ((activeExpensePreview?.items.length ?? 0) * 42) + ((activeExpensePreview?.remainingCount ?? 0) > 0 ? 18 : 0)
    : showDebtPayableLine
      ? 64
      : 48;
  const highlightW = 40;
  const tooltipAlignment = activePoint
    ? activePoint.x < chartW * 0.35
      ? "flex-start"
      : activePoint.x > chartW * 0.7
        ? "flex-end"
        : "center"
    : "center";

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={[styles.tooltipSlot, { height: TOOLTIP_SLOT_HEIGHT, alignItems: tooltipAlignment }]}> 
        {activePoint ? (
          <View style={[styles.tooltipCard, styles.tooltipCardInline, { width: tooltipW, minHeight: tooltipH }]}> 
            <Text style={styles.tooltipTitle}>{activeMetric ? `${activeMetric.label} total` : "Amount"}</Text>
            <Text style={styles.tooltipTotal}>{fmtAmount(activePoint.value)}</Text>

            {showExpenseTooltipPreview ? activeExpensePreview?.items.map((item) => (
              <View key={`${item.planId}:${item.expenseId}`} style={styles.tooltipExpenseBlock}>
                <Text numberOfLines={1} style={styles.tooltipExpenseName}>{item.expenseName}</Text>
                <View style={styles.tooltipExpenseMetaRow}>
                  <Text numberOfLines={1} style={styles.tooltipExpensePlan}>{item.planName}</Text>
                  <Text style={styles.tooltipExpenseAmount}>{fmtAmount(item.amount)}</Text>
                </View>
              </View>
            )) : null}

            {showExpenseTooltipPreview && (activeExpensePreview?.remainingCount ?? 0) > 0 ? (
              <Text style={styles.tooltipMore}>{`+${activeExpensePreview?.remainingCount ?? 0} other`}</Text>
            ) : null}

            {showDebtPayableLine ? (
              <Text style={styles.tooltipMeta}>{`Debt payable ${fmtAmount(plannedDebtPayable)}`}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.chartArea, { width: chartW, height: chartH }]}> 
        <Svg width={chartW} height={chartH}>
          {activePoint ? (
            <Rect
              x={Math.min(chartW - rightPad - highlightW, Math.max(leftPad, activePoint.x - highlightW / 2))}
              y={topPad}
              width={highlightW}
              height={plotH}
              fill={T.accent}
              fillOpacity={0.12}
              rx={10}
            />
          ) : null}

          {yTicks.map((tick) => (
            <Line
              key={tick.ratio}
              x1={leftPad}
              y1={tick.y}
              x2={chartW - rightPad}
              y2={tick.y}
              stroke={T.border}
              strokeWidth={0.7}
              strokeDasharray="3,4"
              opacity={0.6}
            />
          ))}

          <Path d={curvePath} stroke={T.accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((point, index) => (
            <React.Fragment key={chartPoints[index]!.key}>
              {activeIndex === index ? (
                <Circle cx={point.x} cy={point.y} r={11} fill={T.accent} fillOpacity={0.18} />
              ) : null}
              <Circle
                cx={point.x}
                cy={point.y}
                r={activeIndex === index ? 6 : 5}
                fill={chartPoints[index]!.color}
                onPress={() => {
                  setDidUserSelectPoint(true);
                  setActiveIndex(index);
                }}
              />
              {activeIndex === index ? (
                <Circle cx={point.x} cy={point.y} r={3} fill={T.onAccent} />
              ) : null}
            </React.Fragment>
          ))}
        </Svg>

        <View style={styles.yAxisLabels} pointerEvents="none">
          {yTicks.map((tick) => (
            <Text key={tick.ratio} style={[styles.yAxisText, { top: tick.y - 7 }]}>
              {fmtAxis(tick.value)}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.xLabels}>
        {chartPoints.map((point) => (
          <Text key={point.key} style={styles.xLabelText}>{point.label}</Text>
        ))}
      </View>
    </View>
  );
}
