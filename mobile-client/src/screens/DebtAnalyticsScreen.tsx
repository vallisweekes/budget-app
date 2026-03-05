import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  GestureResponderEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, type RouteProp } from "@react-navigation/native";
import Svg, {
  G,
  Circle,
  Line as SvgLine,
  Text as SvgText,
  Rect,
} from "react-native-svg";

import { apiFetch } from "@/lib/api";
import type { DebtSummaryData, DebtSummaryItem, Settings } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import type { DebtStackParamList } from "@/navigation/types";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

type Route = RouteProp<DebtStackParamList, "DebtAnalytics">;

const TYPE_COLORS: Record<string, string> = {
  credit_card: "#e25c5c",
  store_card: "#f4a942",
  loan: "#a78bfa",
  mortgage: "#38bdf8",
  hire_purchase: "#f4a942",
  other: "#64748b",
};

// Assign unique colours when multiple debts share a color
function assignColors(debts: DebtSummaryItem[]): string[] {
  const PALETTE = [
    "#e25c5c", "#f4a942", "#a78bfa", "#38bdf8", "#34d399",
    "#fb923c", "#f472b6", "#60a5fa", "#facc15", "#4ade80",
  ];
  const used: Record<string, number> = {};
  return debts.map((d) => {
    const base = TYPE_COLORS[d.type] ?? T.accent;
    const count = used[base] ?? 0;
    used[base] = count + 1;
    if (count === 0) return base;
    const baseIdx = PALETTE.indexOf(base);
    return PALETTE[(baseIdx + count * 2) % PALETTE.length];
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

function projectDebt(debt: DebtSummaryItem, totalMonthly: number): number {
  const rate = debt.interestRate ? debt.interestRate / 100 / 12 : 0;
  const pmt =
    debt.computedMonthlyPayment > 0
      ? debt.computedMonthlyPayment
      : totalMonthly > 0
      ? totalMonthly
      : debt.currentBalance / 24;
  let b = debt.currentBalance;
  for (let m = 1; m <= 360; m++) {
    b = rate > 0 ? b * (1 + rate) - pmt : b - pmt;
    if (b <= 0) return m;
  }
  return 360;
}

function payoffDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({
  debts,
  colors,
  currency,
}: {
  debts: DebtSummaryItem[];
  colors: string[];
  currency: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const SIZE = 282;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const STROKE = Math.round(SIZE * 0.14);
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;

  const total = debts.reduce((s, d) => s + d.currentBalance, 0);
  if (total === 0) return null;
  const activeDebt = activeIndex != null ? debts[activeIndex] ?? null : null;
  const centerTop = activeDebt
    ? fmt(activeDebt.currentBalance, currency)
    : `${currency}${total.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
  const centerKicker = activeDebt ? "SELECTED" : "TOTAL";
  const centerSubRaw = activeDebt ? (activeDebt.displayTitle ?? activeDebt.name) : `${debts.length} active debts · tap segment`;
  const centerSub = centerSubRaw.length > 28 ? `${centerSubRaw.slice(0, 27)}…` : centerSubRaw;

  const gapLen = Math.max(2, C * 0.004);
  const slices: { len: number; offset: number; rawLen: number; color: string }[] = [];
  let accLen = 0;
  debts.forEach((debt, i) => {
    const rawLen = (debt.currentBalance / total) * C;
    const len = Math.max(0, rawLen - gapLen);
    slices.push({ len, offset: accLen, rawLen, color: colors[i] });
    accLen += rawLen;
  });

  const handleRingPress = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const dx = locationX - CX;
    const dy = locationY - CY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const halfStroke = STROKE / 2;
    const isInsideRing = distance >= R - halfStroke - 6 && distance <= R + halfStroke + 6;
    if (!isInsideRing) {
      setActiveIndex(null);
      return;
    }

    const theta = Math.atan2(dy, dx);
    const angleFromTopClockwise = (theta * 180 / Math.PI + 90 + 360) % 360;
    const targetLen = (angleFromTopClockwise / 360) * C;

    let selected: number | null = null;
    let running = 0;
    for (let i = 0; i < slices.length; i += 1) {
      const next = running + slices[i].rawLen;
      if (targetLen >= running && targetLen <= next) {
        selected = i;
        break;
      }
      running = next;
    }
    setActiveIndex((prev) => (prev === selected ? null : selected));
  };

  return (
    <View style={{ alignItems: "center" }}>
      <Pressable onPress={handleRingPress} hitSlop={8}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={T.border}
            strokeWidth={STROKE}
            opacity={0.35}
          />
          {slices.map((sl, i) => (
            <Circle
              key={i}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={sl.color}
              strokeWidth={activeIndex === i ? STROKE + 2 : STROKE}
              strokeDasharray={`${sl.len} ${C}`}
              strokeDashoffset={-sl.offset}
              strokeLinecap="round"
              rotation={-90}
              originX={CX}
              originY={CY}
              opacity={activeIndex == null || activeIndex === i ? 1 : 0.45}
            />
          ))}
          <SvgText
            x={CX} y={CY - 14}
            fontSize={12} fill={T.textMuted}
            textAnchor="middle" fontWeight="700"
            letterSpacing={0.6}
          >
            {centerKicker}
          </SvgText>
          <SvgText
            x={CX} y={CY + 14}
            fontSize={26} fill={T.text}
            textAnchor="middle" fontWeight="900"
          >
            {centerTop}
          </SvgText>
          <SvgText
            x={CX} y={CY + 34}
            fontSize={12} fill={T.textMuted}
            textAnchor="middle" fontWeight="600"
          >
            {centerSub}
          </SvgText>
        </Svg>
      </Pressable>

      <View style={ds.legendGrid}>
        {debts.map((d, i) => {
          const pct = ((d.currentBalance / total) * 100).toFixed(0);
          return (
            <Pressable
              key={d.id}
              style={({ pressed }) => [
                ds.legendItem,
                activeIndex != null && activeIndex !== i ? ds.legendItemDimmed : null,
                pressed ? ds.legendItemPressed : null,
              ]}
              onPress={() => setActiveIndex((prev) => (prev === i ? null : i))}
              hitSlop={6}
            >
              <View style={[ds.legendDot, { backgroundColor: colors[i] }]} />
              <View style={{ flex: 1 }}>
                <Text style={ds.legendName} numberOfLines={1}>{d.displayTitle ?? d.name}</Text>
                <Text style={ds.legendSub}>{fmt(d.currentBalance, currency)} · {pct}%</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Gantt / Payoff Timeline ───────────────────────────────────────────────────

function GanttChart({
  items,
  maxMonths,
}: {
  items: { debt: DebtSummaryItem; months: number; color: string }[];
  maxMonths: number;
}) {
  const [cw, setCw] = useState(320);
  const BAR_H = 16;
  const ROW_H = 40;
  const LABEL_W = 72;
  const RIGHT_PAD = 54;
  const chartW = cw - LABEL_W - RIGHT_PAD;
  const totalH = items.length * ROW_H + 28;

  const toX = (m: number) => (m / maxMonths) * chartW;
  const ticks = [0, Math.floor(maxMonths / 2), maxMonths];

  return (
    <View
      onLayout={(e) => setCw(e.nativeEvent.layout.width)}
      style={{ width: "100%", height: totalH }}
    >
      <Svg width={cw} height={totalH}>
        {ticks.map((t) => (
          <SvgLine
            key={t}
            x1={LABEL_W + toX(t)} y1={0}
            x2={LABEL_W + toX(t)} y2={totalH - 24}
            stroke={T.border} strokeWidth={1}
          />
        ))}

        {items.map((item, i) => {
          const barW = Math.max(toX(item.months), 6);
          const barY = i * ROW_H + (ROW_H - BAR_H) / 2;
          const name = (item.debt.displayTitle ?? item.debt.name).slice(0, 9) +
            ((item.debt.displayTitle ?? item.debt.name).length > 9 ? "…" : "");
          const payoff = payoffDate(item.months);

          return (
            <G key={item.debt.id}>
              <SvgText
                x={LABEL_W - 6} y={i * ROW_H + ROW_H / 2 + 4}
                fontSize={10} fill={T.textDim}
                textAnchor="end" fontWeight="700"
              >
                {name}
              </SvgText>

              {/* Track */}
              <Rect
                x={LABEL_W} y={barY}
                width={chartW} height={BAR_H}
                rx={BAR_H / 2}
                fill={item.color + "18"}
              />

              {/* Bar */}
              <Rect
                x={LABEL_W} y={barY}
                width={barW} height={BAR_H}
                rx={BAR_H / 2}
                fill={item.color}
                opacity={0.9}
              />

              {/* End cap */}
              <Circle
                cx={LABEL_W + barW} cy={barY + BAR_H / 2}
                r={BAR_H / 2 + 1}
                fill={item.color}
              />

              {/* Payoff date */}
              <SvgText
                x={LABEL_W + chartW + 6}
                y={i * ROW_H + ROW_H / 2 + 4}
                fontSize={9} fill={item.color}
                textAnchor="start" fontWeight="800"
              >
                {payoff}
              </SvgText>
            </G>
          );
        })}

        {/* Axis */}
        <SvgLine
          x1={LABEL_W} y1={totalH - 24}
          x2={LABEL_W + chartW} y2={totalH - 24}
          stroke={T.border} strokeWidth={1}
        />

        {ticks.map((t, idx) => (
          <SvgText
            key={t}
            x={LABEL_W + toX(t)}
            y={totalH - 10}
            fontSize={9} fill={T.textMuted}
            textAnchor={idx === 0 ? "start" : idx === ticks.length - 1 ? "end" : "middle"}
            fontWeight="700"
          >
            {t === 0 ? "Now" : payoffDate(t)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DebtAnalyticsScreen() {
  const route = useRoute<Route>();
  const topContentInset = useTopHeaderOffset(-8);

  const routeDebts = route.params?.debts;
  const routeTotalMonthly = route.params?.totalMonthly;
  const routeCurrency = route.params?.currency;
  const hasRoutePayload = Array.isArray(routeDebts) && typeof routeTotalMonthly === "number" && typeof routeCurrency === "string";

  const [debts, setDebts] = useState<DebtSummaryItem[]>(hasRoutePayload ? routeDebts : []);
  const [totalMonthly, setTotalMonthly] = useState<number>(hasRoutePayload ? routeTotalMonthly : 0);
  const [currency, setCurrency] = useState<string>(hasRoutePayload ? routeCurrency : "£");
  const [loading, setLoading] = useState(!hasRoutePayload);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const [summary, settings] = await Promise.all([
        apiFetch<DebtSummaryData>("/api/bff/debt-summary"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setDebts(summary.debts ?? []);
      setTotalMonthly(summary.totalMonthlyDebtPayments ?? 0);
      setCurrency(settings.currency ?? "£");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasRoutePayload) {
      load();
    }
  }, [hasRoutePayload, load]);

  if (loading) {
    return (
			<SafeAreaView style={s.safe} edges={["bottom"]}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={s.loadingText}>Loading analytics…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
			<SafeAreaView style={s.safe} edges={["bottom"]}>
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}>
            <Text style={s.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const activeDebts = debts
    .filter((d) => d.isActive && !d.paid && d.currentBalance > 0)
    .sort((a, b) => b.currentBalance - a.currentBalance);

  const colors = assignColors(activeDebts);

  const total = activeDebts.reduce((s, d) => s + d.currentBalance, 0);
  const paidTotal = activeDebts.reduce((s, d) => s + d.paidAmount, 0);

  const debtStats = activeDebts.map((d, i) => ({
    debt: d,
    months: projectDebt(d, totalMonthly),
    color: colors[i],
    pctPaid:
      d.initialBalance > 0
        ? ((d.initialBalance - d.currentBalance) / d.initialBalance) * 100
        : 0,
  }));

  const ganttItems = [...debtStats].sort((a, b) => a.months - b.months);
  const maxMonths = Math.max(...debtStats.map((s) => s.months), 1);

  const highestAPR = [...activeDebts]
    .filter((d) => (d.interestRate ?? 0) > 0)
    .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0];

  const earliest = ganttItems[0];
  const latest = ganttItems[ganttItems.length - 1];

  return (
  		<SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: topContentInset }]}>

        {/* Summary strip */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLbl}>REMAINING</Text>
            <Text style={[s.summaryVal, { color: T.red }]}>{fmt(total, currency)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLbl}>MONTHLY</Text>
            <Text style={[s.summaryVal, { color: T.orange }]}>{fmt(totalMonthly, currency)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLbl}>PAID OFF</Text>
            <Text style={[s.summaryVal, { color: T.green }]}>{fmt(paidTotal, currency)}</Text>
          </View>
        </View>

        {/* Chart 1: Donut breakdown */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Debt Breakdown</Text>
          <Text style={s.sectionSub}>Proportion of your total debt</Text>
          <View style={{ marginTop: 14 }}>
            <DonutChart debts={activeDebts} colors={colors} currency={currency} />
          </View>
        </View>

        {/* Chart 2: Payoff Timeline */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Payoff Timeline</Text>
          <Text style={s.sectionSub}>How long until each debt is cleared</Text>
          <View style={{ marginTop: 16 }}>
            <GanttChart items={ganttItems} maxMonths={maxMonths} />
          </View>
        </View>

        {/* Insight chips */}
        <View style={s.chipRow}>
          {earliest && (
            <View style={[s.chip, { borderColor: T.green + "55" }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={T.green} />
              <View style={{ flex: 1 }}>
                <Text style={s.chipLbl}>CLEARS FIRST</Text>
                <Text style={s.chipVal} numberOfLines={1}>
                  {earliest.debt.displayTitle ?? earliest.debt.name}
                </Text>
                <Text style={[s.chipSub, { color: T.green }]}>{payoffDate(earliest.months)}</Text>
              </View>
            </View>
          )}
          {latest && (
            <View style={[s.chip, { borderColor: T.orange + "55" }]}>
              <Ionicons name="hourglass-outline" size={18} color={T.orange} />
              <View style={{ flex: 1 }}>
                <Text style={s.chipLbl}>LAST TO CLEAR</Text>
                <Text style={s.chipVal} numberOfLines={1}>
                  {latest.debt.displayTitle ?? latest.debt.name}
                </Text>
                <Text style={[s.chipSub, { color: T.orange }]}>
                  {payoffDate(latest.months)} · {latest.months}mo
                </Text>
              </View>
            </View>
          )}
        </View>

        {highestAPR && (
          <View style={[s.chip, { borderColor: T.red + "44" }]}>
            <Ionicons name="flame-outline" size={18} color={T.red} />
            <View style={{ flex: 1 }}>
              <Text style={s.chipLbl}>HIGHEST INTEREST</Text>
              <Text style={s.chipVal} numberOfLines={1}>
                {highestAPR.displayTitle ?? highestAPR.name}
              </Text>
              <Text style={[s.chipSub, { color: T.red }]}>
                {highestAPR.interestRate}% APR — pay this down first
              </Text>
            </View>
          </View>
        )}

        {/* Per-debt progress list */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Progress</Text>
          {debtStats.map((item, i) => (
            <View key={item.debt.id} style={[s.debtRow, i > 0 && s.debtRowBorder]}>
              <View style={[s.debtColorBar, { backgroundColor: item.color }]} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={s.debtRowTop}>
                  <Text style={s.debtName} numberOfLines={1}>
                    {item.debt.displayTitle ?? item.debt.name}
                  </Text>
                  <Text style={[s.debtBalance, { color: item.color }]}>
                    {fmt(item.debt.currentBalance, currency)}
                  </Text>
                </View>
                <View style={s.progressBg}>
                  <View
                    style={[
                      s.progressFill,
                      { width: `${Math.max(item.pctPaid, 2)}%` as `${number}%`, backgroundColor: item.color },
                    ]}
                  />
                </View>
                <View style={s.debtRowMeta}>
                  <Text style={s.debtMeta}>{item.pctPaid.toFixed(0)}% paid</Text>
                  {item.debt.interestRate ? (
                    <Text style={s.debtMeta}>{item.debt.interestRate}% APR</Text>
                  ) : null}
                  <Text style={[s.debtMeta, { color: T.green }]}>Free {payoffDate(item.months)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
  loadingText: { color: T.textDim, fontSize: 14, fontWeight: "700" },
  errorText: { color: T.red, textAlign: "center", fontSize: 14, fontWeight: "700" },
  retryBtn: { marginTop: 8, backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "800" },

  scroll: { padding: 14, gap: 12, paddingBottom: 48 },

  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, ...cardBase, padding: 12, alignItems: "center", gap: 4 },
  summaryLbl: { color: T.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  summaryVal: { fontSize: 14, fontWeight: "900" },

  card: { ...cardBase, padding: 16, gap: 2 },
  sectionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  sectionSub: { color: T.textMuted, fontSize: 11, fontWeight: "600" },

  chipRow: { flexDirection: "row", gap: 10 },
  chip: {
    flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 12, borderRadius: 14, backgroundColor: T.cardAlt, borderWidth: 1,
  },
  chipLbl: { color: T.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 0.5, marginBottom: 2 },
  chipVal: { color: T.text, fontSize: 13, fontWeight: "900" },
  chipSub: { fontSize: 11, fontWeight: "700", marginTop: 1 },

  debtRow: { flexDirection: "row", gap: 10, paddingVertical: 12 },
  debtRowBorder: { borderTopWidth: 1, borderTopColor: T.border },
  debtColorBar: { width: 3, borderRadius: 2, alignSelf: "stretch" },
  debtRowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  debtName: { color: T.text, fontSize: 13, fontWeight: "800", flex: 1 },
  debtBalance: { fontSize: 14, fontWeight: "900" },
  debtRowMeta: { flexDirection: "row", gap: 12 },
  debtMeta: { color: T.textDim, fontSize: 11, fontWeight: "600" },
  progressBg: { height: 7, backgroundColor: T.border, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
});

const ds = StyleSheet.create({
  legendGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 8, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8, width: "46%" },
  legendItemPressed: { opacity: 0.9 },
  legendItemDimmed: { opacity: 0.5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { color: T.text, fontSize: 12, fontWeight: "800" },
  legendSub: { color: T.textMuted, fontSize: 10, fontWeight: "600" },
});
