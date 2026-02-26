import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";

type Slice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type Props = {
  currency: string;
  slices: Slice[];
  centerTitle: string;
};

const SIZE = 210;
const STROKE = 30;
const R = (SIZE - STROKE) / 2;
const C = SIZE / 2;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export default function IncomeSacrificePieChart({ currency, slices, centerTitle }: Props) {
  const positiveSlices = useMemo(
    () => slices.filter((slice) => Number(slice.value) > 0),
    [slices],
  );

  const total = useMemo(
    () => positiveSlices.reduce((sum, slice) => sum + Number(slice.value), 0),
    [positiveSlices],
  );

  const arcs = useMemo(() => {
    if (total <= 0) return [] as Array<{ key: string; path: string; color: string }>;
    if (positiveSlices.length === 1) {
      return [] as Array<{ key: string; path: string; color: string }>;
    }
    let acc = 0;
    return positiveSlices.map((slice) => {
      const start = (acc / total) * 360;
      const next = acc + Number(slice.value);
      const end = (next / total) * 360;
      acc = next;
      return {
        key: slice.key,
        path: arcPath(C, C, R, start, end),
        color: slice.color,
      };
    });
  }, [positiveSlices, total]);

  return (
    <View style={s.wrap}>
      <View style={s.chartWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={C} cy={C} r={R} stroke={T.cardAlt} strokeWidth={STROKE} fill="none" />
          {positiveSlices.length === 1 ? (
            <Circle
              cx={C}
              cy={C}
              r={R}
              stroke={positiveSlices[0]!.color}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
          {arcs.map((arc) => (
            <Path
              key={arc.key}
              d={arc.path}
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </Svg>
        <View style={s.centerLabel} pointerEvents="none">
          <Text style={s.centerTitle}>{centerTitle}</Text>
          <Text style={s.centerValue}>{fmt(total, currency)}</Text>
        </View>
      </View>

      <View style={s.legend}>
        {slices.map((slice) => (
          <View key={slice.key} style={s.legendRow}>
            <View style={[s.dot, { backgroundColor: slice.color }]} />
            <Text style={s.legendLabel}>{slice.label}</Text>
            <Text style={s.legendValue}>{fmt(Number(slice.value), currency)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: 10,
    alignItems: "center",
  },
  chartWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  centerLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  centerTitle: {
    color: T.textDim,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  centerValue: {
    color: T.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  legend: {
    width: "100%",
    gap: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    color: T.text,
    fontSize: 12,
    fontWeight: "700",
  },
  legendValue: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
  },
});
