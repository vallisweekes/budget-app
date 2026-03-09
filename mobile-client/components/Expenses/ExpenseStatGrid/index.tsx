import React from "react";
import { View, Text } from "react-native";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import type { ExpenseStatGridProps } from "@/types";

export default function ExpenseStatGrid({
  totalAmount,
  totalCount,
  unpaidAmount,
  unpaidCount,
  currency,
  fmt,
}: ExpenseStatGridProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.lbl}>Total</Text>
        <Text style={[styles.val, { color: T.text }]}>{fmt(totalAmount, currency)}</Text>
        <Text style={styles.sub}>{totalCount} bill{totalCount !== 1 ? "s" : ""}</Text>
      </View>
      <View style={[styles.card, styles.cardOrange]}>
        <Text style={styles.lbl}>Remaining</Text>
        <Text style={[styles.val, { color: T.orange }]}>{fmt(unpaidAmount, currency)}</Text>
        <Text style={styles.sub}>{unpaidCount} due</Text>
      </View>
    </View>
  );
}
