import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { withOpacity } from "@/lib/categoryColors";
import { dueDaysColor, formatDueDate } from "@/lib/helpers/categoryExpenses";
import { fmt } from "@/lib/formatting";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { T } from "@/lib/theme";
import type { Expense } from "@/lib/apiTypes";
import { styles } from "./styles";

type Props = {
  categoryColor: string;
  currency: string;
  expense: Expense;
  onLogoError: (expenseId: string) => void;
  onPress: (expense: Expense) => void;
  logoFailed: boolean;
};

export default function CategoryExpenseCard(props: Props) {
  const amount = Number(props.expense.amount);
  const paidAmount = Number(props.expense.paidAmount);
  const paidAmountClamped = amount > 0 ? Math.min(paidAmount, amount) : 0;
  const remainingAmount = Math.max(amount - paidAmount, 0);
  const ratio = amount > 0 ? Math.min(paidAmount / amount, 1) : props.expense.paid ? 1 : 0;
  const dueColor = props.expense.dueDate ? dueDaysColor(props.expense.dueDate) : null;
  const logoUri = resolveLogoUri(props.expense.logoUrl);
  const showLogo = Boolean(logoUri) && !props.logoFailed;
  const isPartial = !props.expense.paid && paidAmount > 0;
  const statusLabel = props.expense.paid ? "Paid" : isPartial ? "Partial" : "Unpaid";
  const statusColor = props.expense.paid ? T.green : isPartial ? T.orange : T.red;

  return (
    <Pressable style={styles.card} onPress={() => props.onPress(props.expense)}>
      <View style={styles.row1}>
        <View style={styles.logoWrap}>
          {showLogo ? (
            <Image source={{ uri: logoUri! }} style={styles.logoImg} onError={() => props.onLogoError(props.expense.id)} />
          ) : (
            <Text style={styles.logoFallback}>{String(props.expense.name ?? "?").trim()[0]?.toUpperCase() ?? "?"}</Text>
          )}
        </View>

        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={1}>{props.expense.name}</Text>
          <View style={styles.badgeRow}>
            {props.expense.dueDate ? (
              <View
                style={[
                  styles.badge,
                  {
                    borderColor: dueColor ?? T.border,
                    backgroundColor: dueColor ? withOpacity(dueColor, 0.14) : "transparent",
                  },
                ]}
              >
                <Text style={[styles.badgeTxt, { color: dueColor ?? T.textDim }]}>Due {formatDueDate(props.expense.dueDate)}</Text>
              </View>
            ) : null}

            {props.expense.isAllocation ? (
              <View style={[styles.badge, { borderColor: T.border, backgroundColor: withOpacity(T.accent, 0.08) }]}>
                <Text style={[styles.badgeTxt, { color: T.textDim }]}>Allocation</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.rightCol}>
          <View style={[styles.badge, { borderColor: statusColor, backgroundColor: withOpacity(statusColor, 0.14) }]}>
            <Text style={[styles.badgeTxt, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.iconMuted} />
        </View>
      </View>

      <View style={styles.row2}>
        <Text style={styles.amount}>{fmt(amount, props.currency)}</Text>
        <View style={styles.snapshotCol}>
          <View style={styles.snapshotRow}>
            <Text style={styles.snapshotTxt}>Paid: {fmt(paidAmountClamped, props.currency)}</Text>
            <Text style={[styles.snapshotTxt, styles.snapshotRemaining]}>Remaining: {fmt(remainingAmount, props.currency)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: props.categoryColor }]} />
      </View>
    </Pressable>
  );
}