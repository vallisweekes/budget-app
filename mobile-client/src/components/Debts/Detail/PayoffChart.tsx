import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";

function buildProjection(balance: number, monthlyPayment: number, monthlyRate: number, maxMonths = 60): number[] {
  const points: number[] = [balance];
  let current = balance;
  for (let index = 0; index < maxMonths; index += 1) {
    if (current <= 0) break;
    current = monthlyRate > 0 ? current * (1 + monthlyRate) - monthlyPayment : current - monthlyPayment;
    current = Math.max(0, current);
    points.push(current);
    if (current === 0) break;
  }
  return points;
}

type Props = {
  balance: number;
  monthlyPayment: number;
  interestRate: number | null;
  currency: string;
	monthsLeftOverride?: number | null;
	paidOffByOverride?: string | null;
};

export default function PayoffChart({ balance, monthlyPayment, interestRate, currency, monthsLeftOverride, paidOffByOverride }: Props) {
  const [chartWidth, setChartWidth] = React.useState(300);
  const chartHeight = 150;
  const paddingX = 12;
  const paddingY = 14;
  const monthlyRate = interestRate ? interestRate / 100 / 12 : 0;
  const points = buildProjection(balance, monthlyPayment, monthlyRate);
  const totalMonthsComputed = points.length - 1;

  const totalMonths = monthsLeftOverride != null ? Math.max(0, monthsLeftOverride) : totalMonthsComputed;
  const cannotPayoff = monthsLeftOverride === null ? true : monthlyPayment === 0 || points[points.length - 1] > 0;

  const toX = (index: number) => paddingX + (index / Math.max(1, totalMonths)) * (chartWidth - paddingX * 2);
  const toY = (value: number) => paddingY + (1 - (balance > 0 ? value / balance : 0)) * (chartHeight - paddingY * 2);

  const linePath = points.map((value, index) => `${index === 0 ? "M" : "L"}${toX(index).toFixed(1)},${toY(value).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${toX(totalMonths).toFixed(1)},${(chartHeight - paddingY).toFixed(1)} L${toX(0).toFixed(1)},${(chartHeight - paddingY).toFixed(1)} Z`;

  const payoffLabel = (() => {
    if (cannotPayoff || totalMonths <= 0) return null;
    if (paidOffByOverride) {
      const parsed = new Date(paidOffByOverride);
      if (Number.isFinite(parsed.getTime())) {
        return parsed.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      }
    }
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + totalMonths);
    return payoffDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  })();

  return (
    <View>
      <View style={s.strip}>
        <View style={s.stat}><Text style={s.lbl}>REMAINING</Text><Text style={[s.val, { color: T.red }]}>{fmt(balance, currency)}</Text></View>
        <View style={s.statDivider} />
        <View style={s.stat}><Text style={s.lbl}>MONTHS LEFT</Text><Text style={[s.val, { color: cannotPayoff ? T.orange : T.text }]}>{cannotPayoff ? "—" : String(totalMonths)}</Text></View>
        <View style={s.statDivider} />
        <View style={s.stat}><Text style={s.lbl}>PAID OFF BY</Text><Text style={[s.val, { color: T.green }]}>{payoffLabel ?? "—"}</Text></View>
      </View>

      <View onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)} style={{ width: "100%", height: chartHeight, marginTop: 8 }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={T.accent} stopOpacity="0.4" />
              <Stop offset="1" stopColor={T.accent} stopOpacity="0.03" />
            </LinearGradient>
          </Defs>
          <Line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke={T.border} strokeWidth={1} />
          <Path d={areaPath} fill="url(#payGrad)" />
          <Path d={linePath} stroke={T.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={toX(0)} cy={toY(balance)} r={4.5} fill={T.accent} />
          {!cannotPayoff ? <Circle cx={toX(totalMonths)} cy={toY(0)} r={4.5} fill={T.green} /> : null}
        </Svg>
      </View>

      {cannotPayoff && monthlyPayment === 0 ? <Text style={s.warn}>Enter a payment amount to see your payoff projection.</Text> : null}
      {cannotPayoff && monthlyPayment > 0 ? <Text style={s.warn}>Payment may not cover interest — try increasing it.</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  strip: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: T.border },
  lbl: { color: T.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  val: { color: T.text, fontSize: 14, fontWeight: "900", marginTop: 2 },
  warn: { color: T.orange, fontSize: 11, fontWeight: "600", marginTop: 8, textAlign: "center" },
});
