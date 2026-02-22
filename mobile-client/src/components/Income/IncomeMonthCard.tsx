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
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    minWidth: "44%",
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
    gap: 4,
  },
  cardPressed: { opacity: 0.7 },
  month: {
    color: "rgba(15,40,47,0.55)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amount: { color: "#0f282f", fontSize: 17, fontWeight: "900" },
  count: { color: "rgba(15,40,47,0.55)", fontSize: 11, fontWeight: "600" },
  empty: { color: "rgba(15,40,47,0.25)", fontSize: 16, fontWeight: "900" },
});
