import React from "react";
import { Text, View, Pressable, ViewStyle } from "react-native";
import type { IncomeSummaryMonth } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";
import { styles } from "./styles";
import type { IncomeMonthCardProps } from "@/types";

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
  periodLabel,
}: IncomeMonthCardProps) {
  const hasIncome = item.total > 0;

  const cardStyle: ViewStyle = {
    borderColor: active ? T.accentFaint : T.border,
    opacity: locked ? 0.78 : 1,
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, cardStyle, pressed && styles.cardPressed]}
      onPress={onPress}
      disabled={typeof onPress !== "function"}
    >
      {/* Month label + optional "Current" badge */}
      <View style={styles.monthRow}>
        <Text style={[styles.month, active && styles.monthActive]}>
          {periodLabel ?? MONTH_NAMES_SHORT[item.monthIndex - 1]}
        </Text>
        {active && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>Current</Text>
          </View>
        )}
      </View>
      {hasIncome ? (
        <>
          <Text style={styles.amount}>{fmt(item.total, currency)}</Text>
          <Text style={styles.count}>
            {item.items.length} source{item.items.length !== 1 ? "s" : ""}
          </Text>
        </>
      ) : (
        <Text style={styles.empty}>—</Text>
      )}
    </Pressable>
  );
}
