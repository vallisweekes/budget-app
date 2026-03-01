import React, { useMemo } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { T } from "@/lib/theme";

// Arc colours — matching the web client's PieCategories palette
const COLOR_REMAINING = "#06b6d4"; // site cyan-blue — left to spend
const COLOR_COMMITTED = "#a855f7"; // site purple    — committed spending
const COLOR_PAID      = T.accent;  // deep purple    — already spent

interface Props {
  totalBudget: number;
  totalExpenses: number;
  paidTotal: number;
  currency: string;
  fmt: (v: number | string | null | undefined, c: string) => string;
}

const W = Dimensions.get("window").width;

export default function BudgetDonutCard({ totalBudget, totalExpenses, paidTotal, currency, fmt }: Props) {
  const { remaining, isOverBudget, paidFrac, committedFrac } = useMemo(() => {
    const safeBudget   = Math.max(0, totalBudget   ?? 0);
    const safeExpenses = Math.max(0, totalExpenses ?? 0);
    const safePaid     = Math.max(0, paidTotal     ?? 0);

    const paid      = Math.min(safeExpenses, safePaid);
    const committed = Math.max(0, safeExpenses - paid);
    const left      = safeBudget - safeExpenses;
    const over      = left < 0;

    const paidF      = safeBudget > 0 ? Math.min(1, paid / safeBudget) : 0;
    const committedF = safeBudget > 0 ? Math.min(1 - paidF, committed / safeBudget) : 0;

    return {
      remaining:      left,
      isOverBudget:   over,
      paidFrac:       paidF,
      committedFrac:  committedF,
    };
  }, [paidTotal, totalBudget, totalExpenses]);

  if (!(totalBudget > 0) && !(totalExpenses > 0)) return null;

  // Chart geometry
  const SIZE    = Math.min(220, Math.floor((W - 80) * 0.72));
  const cx      = SIZE / 2;
  const cy      = SIZE / 2;
  const STROKE  = Math.round(SIZE * 0.135);
  const r       = (SIZE - STROKE) / 2;
  const C       = 2 * Math.PI * r; // full circumference

  const paidLen      = paidFrac      * C;
  const committedLen = committedFrac * C;

  const centerTop = fmt(remaining, currency);
  const centerSub = isOverBudget
    ? `over budget (budget ${fmt(totalBudget, currency)})`
    : `left of ${fmt(totalBudget, currency)}`;

  return (
    <View style={s.card}>
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
        <View style={[s.centerWrap, { width: SIZE, height: SIZE }]}>
          <Text
            style={[s.centerValue, isOverBudget && { color: T.red }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {centerTop}
          </Text>
          <Text style={s.centerSub}>{centerSub}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: "center",
  },
  centerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  centerValue: {
    color: T.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  centerSub: {
    marginTop: 4,
    color: T.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
});
