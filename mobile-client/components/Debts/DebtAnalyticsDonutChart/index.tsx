import React, { useMemo, useState } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useAppTranslation } from "@/hooks";
import type { DebtAnalyticsDonutChartProps, DebtAnalyticsColorSlice } from "@/types";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { debtAnalyticsStyles as s } from "@/components/DebtAnalyticsScreen/style";

export default function DebtAnalyticsDonutChart({ colors, currency, debts }: DebtAnalyticsDonutChartProps) {
  const { t } = useAppTranslation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const size = 228;
  const centerX = size / 2;
  const centerY = size / 2;
  const stroke = 32;
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
  const activePct = activeDebt ? Math.round((activeDebt.currentBalance / total) * 100) : null;
  const centerTop = activeDebt
    ? fmt(activeDebt.currentBalance, currency)
    : fmt(total, currency);
  const centerTitle = activeDebt ? (activeDebt.displayTitle ?? activeDebt.name) : t("debts.analytics.totalDebt");
  const centerSub = activeDebt
    ? t("debts.analytics.percentOfTotalDebt", { percent: activePct ?? 0 })
    : debts.length === 1
      ? t("debts.analytics.activeDebtOne", { count: debts.length })
      : t("debts.analytics.activeDebtOther", { count: debts.length });

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
    <View style={{ alignItems: "center", width: "100%" }}>
      <View style={s.donutShell}>
        <View style={s.donutHalo} />
        <Pressable onPress={handleRingPress} hitSlop={8} style={s.donutWrap}>
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
          </Svg>

          <View style={s.donutCenterLabel} pointerEvents="none">
            <Text style={s.donutCenterTitle} numberOfLines={2}>{centerTitle}</Text>
            <Text style={s.donutCenterValue} numberOfLines={1} adjustsFontSizeToFit>{centerTop}</Text>
            <Text style={s.donutCenterSub} numberOfLines={2}>{centerSub}</Text>
          </View>
        </Pressable>
      </View>

    </View>
  );
}
