import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { IncomeMonthData } from "@/lib/apiTypes";
import { T } from "@/lib/theme";

interface Props {
  data: IncomeMonthData;
  currency: string;
}

const W = Dimensions.get("window").width;

const POINTS: Array<{
  key: keyof IncomeMonthData;
  label: string;
  color: string;
}> = [
  { key: "plannedExpenses", label: "Expenses", color: T.red },
  { key: "plannedDebtPayments", label: "Debts", color: T.orange },
  { key: "incomeSacrifice", label: "Sacrifice", color: T.accent },
];

export default function IncomeBarChart({ data: a, currency }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [didUserSelectPoint, setDidUserSelectPoint] = useState(false);

  const values = useMemo(() => POINTS.map((point) => Number(a[point.key]) || 0), [a]);
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

  const tooltipW = 98;
  const tooltipH = 34;
  const highlightW = 40;
  const tooltipX = activePoint
    ? Math.min(
        chartW - rightPad - tooltipW,
        Math.max(leftPad, activePoint.x - tooltipW / 2)
      )
    : 0;
  const tooltipY = activePoint ? Math.max(6, activePoint.y - tooltipH - 14) : 0;
  const tooltipPointerX = activePoint
    ? Math.min(tooltipX + tooltipW - 10, Math.max(tooltipX + 10, activePoint.x))
    : 0;

  return (
    <View style={s.wrap}>
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
          <React.Fragment key={POINTS[index]!.key}>
            {activeIndex === index ? (
              <Circle cx={point.x} cy={point.y} r={11} fill={T.accent} fillOpacity={0.18} />
            ) : null}
            <Circle
              cx={point.x}
              cy={point.y}
              r={activeIndex === index ? 6 : 5}
              fill={POINTS[index]!.color}
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

        {activePoint ? (
          <>
            <Rect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx={10} fill={T.text} opacity={0.96} />
            <Path
              d={`M ${tooltipPointerX - 7} ${tooltipY + tooltipH} L ${tooltipPointerX + 7} ${tooltipY + tooltipH} L ${tooltipPointerX} ${tooltipY + tooltipH + 8} Z`}
              fill={T.text}
              opacity={0.96}
            />
            <SvgText
              x={tooltipX + tooltipW / 2}
              y={tooltipY + 22}
              fill={T.bg}
              fontSize={15}
              fontWeight="900"
              textAnchor="middle"
            >
              {fmtAmount(activePoint.value)}
            </SvgText>
          </>
        ) : null}
      </Svg>

      <View style={s.yAxisLabels} pointerEvents="none">
        {yTicks.map((tick) => (
          <Text key={tick.ratio} style={[s.yAxisText, { top: tick.y - 7 }]}>
            {fmtAxis(tick.value)}
          </Text>
        ))}
      </View>

      <View style={s.xLabels}>
        {POINTS.map((point) => (
          <Text key={point.key} style={s.xLabelText}>{point.label}</Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: T.card,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: T.border,
    position: "relative",
  },
  yAxisLabels: {
    position: "absolute",
    left: 8,
    top: 0,
    bottom: 38,
    width: 38,
  },
  yAxisText: {
    position: "absolute",
    color: T.textDim,
    fontSize: 10,
    fontWeight: "700",
  },
  xLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 42,
    paddingRight: 12,
    marginTop: -6,
  },
  xLabelText: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
});
