import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Expense } from "@/lib/apiTypes";
import { resolveCategoryColor } from "@/lib/categoryColors";
import { T } from "@/lib/theme";

interface Props {
  expense: Expense;
  currency: string;
  fmt: (v: number | string | null | undefined, c: string) => string;
}

export default function ExpenseItem({ expense, currency, fmt }: Props) {
  const color = resolveCategoryColor(expense.category?.color);

  const paidAmount = parseFloat(expense.paidAmount);
  const isPartial = !expense.paid && Number.isFinite(paidAmount) && paidAmount > 0;
  const badgeLabel = expense.paid ? "paid" : isPartial ? "partial" : "unpaid";
  const badgeColor = expense.paid ? T.green : isPartial ? T.orange : T.red;

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
        <View style={[s.badge, { borderColor: badgeColor }]}> 
          <Text style={[s.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  name: { color: T.text, fontSize: 14, fontWeight: "800" },
  cat: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
  right: { alignItems: "flex-end", gap: 5, flexShrink: 0 },
  amount: { color: T.text, fontSize: 14, fontWeight: "900" },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
