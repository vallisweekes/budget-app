import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Expense } from "@/lib/apiTypes";
import { resolveCategoryColor } from "@/lib/categoryColors";

interface Props {
  expense: Expense;
  currency: string;
  fmt: (v: number | string | null | undefined, c: string) => string;
}

export default function ExpenseItem({ expense, currency, fmt }: Props) {
  const color = resolveCategoryColor(expense.category?.color);
  return (
    <View style={s.row}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>
          {expense.name}
        </Text>
        {expense.category && (
          <Text style={s.cat} numberOfLines={1}>
            {expense.category.name}
          </Text>
        )}
      </View>
      <View style={s.right}>
        <Text style={s.amount}>{fmt(expense.amount, currency)}</Text>
        <View style={[s.badge, expense.paid ? s.badgePaid : s.badgeDue]}>
          <Text style={s.badgeText}>{expense.paid ? "paid" : "due"}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  name: { color: "#fff", fontSize: 14, fontWeight: "600" },
  cat: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 5, flexShrink: 0 },
  amount: { color: "#fff", fontSize: 14, fontWeight: "700" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgePaid: { backgroundColor: "rgba(62,201,126,0.15)" },
  badgeDue: { backgroundColor: "rgba(244,169,66,0.15)" },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
  },
});
