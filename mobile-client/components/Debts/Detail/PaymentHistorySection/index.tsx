import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useAppLocale } from "@/hooks";
import type { PaymentHistorySectionProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { styles } from "./styles";

const STATEMENT_PERIOD_NOTE = /^month:(\d{4})-(\d{2})$/;

type PaymentGroup = {
  key: string;
  label: string;
  caption: string | null;
  total: number;
  items: PaymentHistorySectionProps["payments"];
};

function formatMonthLabel(date: Date, locale: string) {
  return date.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function getGroupMeta(payment: PaymentHistorySectionProps["payments"][number], locale: string) {
  const rawNotes = typeof payment.notes === "string" ? payment.notes.trim() : "";
  const statementMatch = STATEMENT_PERIOD_NOTE.exec(rawNotes);

  if (statementMatch) {
    const year = Number(statementMatch[1]);
    const monthIndex = Number(statementMatch[2]) - 1;
    const statementDate = new Date(year, monthIndex, 1);
    return {
      key: `statement:${statementMatch[1]}-${statementMatch[2]}`,
      label: formatMonthLabel(statementDate, locale),
      caption: "Statement period",
    };
  }

  const paidDate = new Date(payment.paidAt);
  const year = paidDate.getFullYear();
  const month = String(paidDate.getMonth() + 1).padStart(2, "0");
  return {
    key: `paid:${year}-${month}`,
    label: formatMonthLabel(paidDate, locale),
    caption: null,
  };
}

function getPaymentTitle(payment: PaymentHistorySectionProps["payments"][number]) {
  const rawNotes = typeof payment.notes === "string" ? payment.notes.trim() : "";
  if (rawNotes && !STATEMENT_PERIOD_NOTE.test(rawNotes)) return rawNotes;

  if (payment.source === "income") return "Payment from income";
  if (payment.source === "extra_funds") return "Payment from extra funds";
  if (payment.source === "credit_card") return "Payment from card";
  return "Payment recorded";
}

export default function PaymentHistorySection({
  payments,
  currency,
  latestUndoablePaymentId,
  undoingPaymentId,
  onUndoPayment,
}: PaymentHistorySectionProps) {
  const { formatDate, locale } = useAppLocale();
  const groupedPayments = React.useMemo(() => {
    const groups: PaymentGroup[] = [];
    const byKey = new Map<string, PaymentGroup>();

    payments.forEach((payment) => {
      const groupMeta = getGroupMeta(payment, locale);
      const existingGroup = byKey.get(groupMeta.key);
      const amount = Number.parseFloat(payment.amount);

      if (existingGroup) {
        existingGroup.items.push(payment);
        existingGroup.total += Number.isFinite(amount) ? amount : 0;
        return;
      }

      const nextGroup: PaymentGroup = {
        key: groupMeta.key,
        label: groupMeta.label,
        caption: groupMeta.caption,
        total: Number.isFinite(amount) ? amount : 0,
        items: [payment],
      };

      byKey.set(groupMeta.key, nextGroup);
      groups.push(nextGroup);
    });

    return groups;
  }, [locale, payments]);

  return (
    <View style={styles.historySection}>
      <View style={styles.histHeader}>
        <View style={styles.histHeaderLeft}>
          <Text style={styles.sectionTitle}>Payments</Text>
          <View style={styles.histCountBadge}><Text style={styles.histCountText}>{payments.length}</Text></View>
        </View>
      </View>

      {latestUndoablePaymentId ? (
        <Text style={styles.historyHint}>Need to fix a mistake? Undo the latest payment from this month.</Text>
      ) : null}

      {payments.length === 0 ? (
        <Text style={styles.emptyHistory}>No payments recorded yet.</Text>
      ) : (
        groupedPayments.map((group) => (
          <View key={group.key} style={styles.monthGroup}>
            <View style={styles.monthHeader}>
              <View style={styles.monthHeaderCopy}>
                <Text style={styles.monthTitle}>{group.label}</Text>
                {group.caption ? <Text style={styles.monthCaption}>{group.caption}</Text> : null}
              </View>
              <Text style={styles.monthTotal}>- {fmt(group.total, currency)}</Text>
            </View>

            {group.items.map((payment, index) => (
              <View key={payment.id} style={[styles.payHistRow, index > 0 && styles.payHistBorder]}>
                <View style={styles.payHistLeft}>
                  <Text style={styles.payHistTitle} numberOfLines={1} ellipsizeMode="tail">
                    {getPaymentTitle(payment)}
                  </Text>
                  <Text style={styles.payHistMeta} numberOfLines={1} ellipsizeMode="tail">
                    {formatDate(new Date(payment.paidAt), {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                <View style={styles.payHistRight}>
                  <Text style={styles.payHistAmt} numberOfLines={1} ellipsizeMode="clip">
                    - {fmt(parseFloat(payment.amount), currency)}
                  </Text>
                  {payment.id === latestUndoablePaymentId && onUndoPayment ? (
                    <Pressable
                      style={[
                        styles.payHistUndoButton,
                        undoingPaymentId === payment.id && styles.payHistUndoButtonDisabled,
                      ]}
                      onPress={() => onUndoPayment(payment.id)}
                      disabled={undoingPaymentId === payment.id}
                    >
                      {undoingPaymentId === payment.id ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.payHistUndoText}>Undo</Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}
