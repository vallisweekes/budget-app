import React from "react";
import { Text, View, Pressable, StyleSheet, ViewStyle } from "react-native";
import type { IncomeSummaryMonth } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

interface Props {
  item: IncomeSummaryMonth;
  currency: string;
  fmt: (v: number, c: string) => string;
  onPress: () => void;
  active?: boolean;
  locked?: boolean;
}

const MONTH_NAMES_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export default function IncomeMonthCard({
  item,
  currency,
  fmt,
  onPress,
  active,
  locked,
}: Props) {
  const hasIncome = item.total > 0;

  const cardStyle: ViewStyle = {
    borderColor: active ? T.accentFaint : T.border,
    opacity: locked ? 0.45 : 1,
  };

  return (
    <Pressable
      style={({ pressed }) => [s.card, cardStyle, !locked && pressed && s.cardPressed]}
      onPress={locked ? undefined : onPress}
      disabled={locked}
    >
      {/* Month label + optional "Current" badge */}
      <View style={s.monthRow}>
        <Text style={[s.month, active && s.monthActive]}>
          {MONTH_NAMES_SHORT[item.monthIndex - 1]}
        </Text>
        {active && (
          <View style={s.currentBadge}>
            <Text style={s.currentBadgeText}>Current</Text>
          </View>
        )}
      </View>
      {hasIncome ? (
        <>
          <Text style={s.amount}>{fmt(item.total, currency)}</Text>
          <Text style={s.count}>
            {item.items.length} source{item.items.length !== 1 ? "s" : ""}
          </Text>
        </>
      ) : (
        <Text style={s.empty}>—</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    ...cardElevated,
    padding: 16,
    minWidth: "44%",
    gap: 4,
  },
  cardPressed: { opacity: 0.7 },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 2 },
  month: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  monthActive: { color: T.text },
  currentBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: T.accentDim,
    borderWidth: 1,
    borderColor: T.accentFaint,
  },
  currentBadgeText: { color: T.text, fontSize: 10, fontWeight: "700" },
  amount: { color: T.text, fontSize: 17, fontWeight: "900" },
  count: { color: T.textDim, fontSize: 11, fontWeight: "600" },
  empty: { color: T.textMuted, fontSize: 16, fontWeight: "900" },
});
