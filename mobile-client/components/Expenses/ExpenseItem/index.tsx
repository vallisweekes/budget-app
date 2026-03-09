import React from "react";
import { View, Text } from "react-native";
import { resolveCategoryColor } from "@/lib/categoryColors";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import type { ExpenseItemProps } from "@/types";
export default function ExpenseItem({ expense, currency, fmt }: ExpenseItemProps) {
  const color = resolveCategoryColor(expense.category?.color);

  const paidAmount = parseFloat(expense.paidAmount);
  const isPartial = !expense.paid && Number.isFinite(paidAmount) && paidAmount > 0;
  const badgeLabel = expense.paid ? "paid" : isPartial ? "partial" : "unpaid";
  const badgeColor = expense.paid ? T.green : isPartial ? T.orange : T.red;

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {expense.name}
        </Text>
        {expense.category && (
          <Text style={styles.cat} numberOfLines={1}>
            {expense.category.name}
          </Text>
        )}
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{fmt(expense.amount, currency)}</Text>
        <View style={[styles.badge, { borderColor: badgeColor }]}> 
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </View>
      </View>
    </View>
  );
}
