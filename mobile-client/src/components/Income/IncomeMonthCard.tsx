import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { IncomeSummaryMonth } from "@/lib/apiTypes";

interface Props {
  item: IncomeSummaryMonth;
  currency: string;
  fmt: (v: number, c: string) => string;
  onPress: () => void;
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
}: Props) {
  const hasIncome = item.total > 0;
  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={onPress}
    >
      <Text style={s.month}>
        {MONTH_NAMES_SHORT[item.monthIndex - 1]}
      </Text>
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
    backgroundColor: "#0a1e23",
    borderRadius: 12,
    padding: 14,
    minWidth: "44%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 4,
  },
  cardPressed: { opacity: 0.7 },
  month: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amount: { color: "#fff", fontSize: 17, fontWeight: "700" },
  count: { color: "rgba(255,255,255,0.35)", fontSize: 11 },
  empty: { color: "rgba(255,255,255,0.15)", fontSize: 16, fontWeight: "700" },
});
