import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";

import type { PayoffChartProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { buildProjection, derivePayoffSummary } from "@/lib/domain/debtPayoff";
import { T } from "@/lib/theme";
import { styles } from "./styles";

export default function PayoffChart({ balance, monthlyPayment, interestRate, currency, monthsLeftOverride, paidOffByOverride, cannotPayoffOverride, payoffLabelOverride, horizonLabelOverride }: PayoffChartProps) {
  const [chartWidth, setChartWidth] = React.useState(300);
  const chartHeight = 164;
  const paddingX = 12;
  const paddingY = 18;
  const monthlyRate = interestRate ? interestRate / 100 / 12 : 0;
  const points = buildProjection(balance, monthlyPayment, monthlyRate);
  const fallbackSummary = derivePayoffSummary({
    points,
    monthlyPayment,
    monthsLeftOverride,
    paidOffByOverride,
  });
  const totalMonths = monthsLeftOverride != null ? Math.max(0, monthsLeftOverride) : fallbackSummary.totalMonths;
  const cannotPayoff = typeof cannotPayoffOverride === "boolean" ? cannotPayoffOverride : fallbackSummary.cannotPayoff;
  const payoffLabel = payoffLabelOverride ?? fallbackSummary.payoffLabel;
  const horizonLabel = horizonLabelOverride ?? fallbackSummary.horizonLabel;

  const toX = (index: number) => paddingX + (index / Math.max(1, totalMonths)) * (chartWidth - paddingX * 2);
  const toY = (value: number) => paddingY + (1 - (balance > 0 ? value / balance : 0)) * (chartHeight - paddingY * 2);

  const axisLeftX = paddingX;
  const axisBottomY = chartHeight - paddingY;
  const axisTopY = paddingY;
  const axisRightX = chartWidth - paddingX;

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const linePath = points.map((value, index) => `${index === 0 ? "M" : "L"}${toX(index).toFixed(1)},${toY(value).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${toX(totalMonths).toFixed(1)},${(chartHeight - paddingY).toFixed(1)} L${toX(0).toFixed(1)},${(chartHeight - paddingY).toFixed(1)} Z`;

  const assumptionLabel = monthlyPayment > 0 ? `Assumes ${fmt(monthlyPayment, currency)}/month` : null;

  return (
    <View>
      <View style={styles.strip}>
        <View style={styles.stat}><Text style={styles.lbl}>REMAINING</Text><Text style={[styles.val, { color: T.red }]}>{fmt(balance, currency)}</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.stat}><Text style={styles.lbl}>MONTHS LEFT</Text><Text style={[styles.val, { color: cannotPayoff ? T.orange : T.text }]}>{cannotPayoff ? "—" : String(totalMonths)}</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.stat}><Text style={styles.lbl}>PAID OFF BY</Text><Text style={[styles.val, { color: T.green }]}>{payoffLabel ?? "—"}</Text></View>
      </View>

      {assumptionLabel ? <Text style={styles.assumption}>{assumptionLabel}</Text> : null}

      <View onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)} style={{ width: "100%", height: chartHeight, marginTop: 8 }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={T.accent} stopOpacity="0.4" />
              <Stop offset="1" stopColor={T.accent} stopOpacity="0.03" />
            </LinearGradient>
          </Defs>
          {/* Baseline */}
          <Line x1={axisLeftX} y1={axisBottomY} x2={axisRightX} y2={axisBottomY} stroke={T.border} strokeWidth={1} />

          <Path d={areaPath} fill="url(#payGrad)" />
          <Path d={linePath} stroke={T.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={toX(0)} cy={toY(balance)} r={4.5} fill={T.accent} />
          {!cannotPayoff ? <Circle cx={toX(totalMonths)} cy={toY(0)} r={4.5} fill={T.green} /> : null}

          {/* Friendly labels */}
          <SvgText
            x={clamp(toX(0) + 8, axisLeftX + 6, axisRightX - 6)}
            y={clamp(toY(balance) - 12, axisTopY + 2, axisBottomY - 18)}
            fill={T.textDim}
            fontSize={10}
            fontWeight={800}
            textAnchor="start"
            alignmentBaseline="baseline"
          >
            {`${fmt(balance, currency)} today`}
          </SvgText>

          {!cannotPayoff ? (
            <SvgText
              x={clamp(toX(totalMonths) - 8, axisLeftX + 6, axisRightX - 6)}
              y={clamp(toY(0) - 12, axisTopY + 2, axisBottomY - 18)}
              fill={T.textDim}
              fontSize={10}
              fontWeight={800}
              textAnchor="end"
              alignmentBaseline="baseline"
            >
              {fmt(0, currency)}
            </SvgText>
          ) : null}

          <SvgText x={axisLeftX} y={axisBottomY + 14} fill={T.textDim} fontSize={10} fontWeight={800} textAnchor="start" alignmentBaseline="baseline">
            Now
          </SvgText>
          <SvgText x={axisRightX} y={axisBottomY + 14} fill={T.textDim} fontSize={10} fontWeight={800} textAnchor="end" alignmentBaseline="baseline">
            {horizonLabel}
          </SvgText>
        </Svg>
      </View>

      {cannotPayoff && monthlyPayment === 0 ? <Text style={styles.warn}>Enter a payment amount to see your payoff projection.</Text> : null}
      {cannotPayoff && monthlyPayment > 0 ? <Text style={styles.warn}>Payment may not cover interest — try increasing it.</Text> : null}
    </View>
  );
}
