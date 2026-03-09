import React, { useMemo, useState } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

import type { DebtAnalyticsDonutChartProps, DebtAnalyticsColorSlice } from "@/types";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { debtAnalyticsStyles as s } from "@/components/DebtAnalyticsScreen/style";

export default function DebtAnalyticsDonutChart({ colors, currency, debts }: DebtAnalyticsDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const size = 282;
  const centerX = size / 2;
  const centerY = size / 2;
  const stroke = Math.round(size * 0.14);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = debts.reduce((sum, debt) => sum + debt.currentBalance, 0);

  const slices = useMemo<DebtAnalyticsColorSlice[]>(() => {
    const gapLen = Math.max(2, circumference * 0.004);
    const nextSlices: DebtAnalyticsColorSlice[] = [];
    let accumulatedLength = 0;

    debts.forEach((debt, index) => {
      const rawLen = (debt.currentBalance / total) * circumference;
      const len = Math.max(0, rawLen - gapLen);
      nextSlices.push({ len, offset: accumulatedLength, rawLen, color: colors[index] });
      accumulatedLength += rawLen;
    });

    return nextSlices;
  }, [circumference, colors, debts, total]);

  if (total === 0) return null;

  const activeDebt = activeIndex != null ? debts[activeIndex] ?? null : null;
  const centerTop = activeDebt
    ? fmt(activeDebt.currentBalance, currency)
    : `${currency}${total.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
  const centerKicker = activeDebt ? "SELECTED" : "TOTAL";
  const centerSubRaw = activeDebt
    ? (activeDebt.displayTitle ?? activeDebt.name)
    : `${debts.length} active debts · tap segment`;
  const centerSub = centerSubRaw.length > 28 ? `${centerSubRaw.slice(0, 27)}…` : centerSubRaw;

  const handleRingPress = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const dx = locationX - centerX;
    const dy = locationY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const halfStroke = stroke / 2;
    const isInsideRing = distance >= radius - halfStroke - 6 && distance <= radius + halfStroke + 6;
    if (!isInsideRing) {
      setActiveIndex(null);
      return;
    }

    const theta = Math.atan2(dy, dx);
    const angleFromTopClockwise = (theta * 180 / Math.PI + 90 + 360) % 360;
    const targetLen = (angleFromTopClockwise / 360) * circumference;

    let selected: number | null = null;
    let running = 0;
    for (let index = 0; index < slices.length; index += 1) {
      const next = running + slices[index].rawLen;
      if (targetLen >= running && targetLen <= next) {
        selected = index;
        break;
      }
      running = next;
    }

    setActiveIndex((previous) => (previous === selected ? null : selected));
  };

  return (
    <View style={{ alignItems: "center" }}>
      <Pressable onPress={handleRingPress} hitSlop={8}>
        <Svg width={size} height={size}>
          <Circle cx={centerX} cy={centerY} r={radius} fill="none" stroke={T.border} strokeWidth={stroke} opacity={0.35} />
          {slices.map((slice, index) => (
            <Circle
              key={debts[index]?.id ?? index}
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={activeIndex === index ? stroke + 2 : stroke}
              strokeDasharray={`${slice.len} ${circumference}`}
              strokeDashoffset={-slice.offset}
              strokeLinecap="round"
              rotation={-90}
              originX={centerX}
              originY={centerY}
              opacity={activeIndex == null || activeIndex === index ? 1 : 0.45}
            />
          ))}
          <SvgText x={centerX} y={centerY - 14} fontSize={12} fill={T.textMuted} textAnchor="middle" fontWeight="700" letterSpacing={0.6}>{centerKicker}</SvgText>
          <SvgText x={centerX} y={centerY + 14} fontSize={26} fill={T.text} textAnchor="middle" fontWeight="900">{centerTop}</SvgText>
          <SvgText x={centerX} y={centerY + 34} fontSize={12} fill={T.textMuted} textAnchor="middle" fontWeight="600">{centerSub}</SvgText>
        </Svg>
      </Pressable>

      <View style={s.legendGrid}>
        {debts.map((debt, index) => {
          const pct = ((debt.currentBalance / total) * 100).toFixed(0);
          return (
            <Pressable
              key={debt.id}
              style={({ pressed }) => [
                s.legendItem,
                activeIndex != null && activeIndex !== index ? s.legendItemDimmed : null,
                pressed ? s.legendItemPressed : null,
              ]}
              onPress={() => setActiveIndex((previous) => (previous === index ? null : index))}
              hitSlop={6}
            >
              <View style={[s.legendDot, { backgroundColor: colors[index] }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.legendName} numberOfLines={1}>{debt.displayTitle ?? debt.name}</Text>
                <Text style={s.legendSub}>{fmt(debt.currentBalance, currency)} · {pct}%</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
