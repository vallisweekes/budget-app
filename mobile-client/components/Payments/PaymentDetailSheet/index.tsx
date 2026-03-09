import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

import { fmt } from "@/lib/formatting";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { T } from "@/lib/theme";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";

export type PaymentDetail = {
  kind: "expense" | "debt";
  budgetPlanId: string;
  id: string;
  name: string;
  dueAmount: number;
  dueDate: string | null;
  dueDay: number | null;
  overdue: boolean;
  missed: boolean;
  isMissedPayment?: boolean;
  dueLabel?: string;
  paymentsTotal?: number;
  remaining?: number;
  isPaid?: boolean;
  isPartial?: boolean;
  statusTag?: "Missed" | "Overdue" | "Paid" | "Partial" | "Unpaid";
  statusDescription?: string;
  payments: Array<{
    id: string;
    amount: number;
    date: string;
    source: string;
  }>;
};

type SheetItem = {
  kind: "expense" | "debt";
  id: string;
  name: string;
  dueAmount: number;
  logoUrl?: string | null;
};

type Props = {
  visible: boolean;
  insetsBottom: number;
  currency: string;
  item: SheetItem | null;
  detail: PaymentDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: (item: SheetItem) => void;
};

export default function PaymentDetailSheet({
  visible,
  insetsBottom,
  currency,
  item,
  detail,
  loading,
  error,
  onClose,
  onRetry,
}: Props) {
  const { dragY, panHandlers } = useSwipeDownToClose({ onClose });
  const [logoFailed, setLogoFailed] = useState(false);

  const heroName = String(item?.name ?? "Payment").trim();
  const heroInitial = (heroName?.[0] ?? "?").toUpperCase();
  const logoUri = useMemo(() => resolveLogoUri(item?.logoUrl), [item?.logoUrl]);
  const showLogo = Boolean(logoUri) && !logoFailed;

  useEffect(() => {
    setLogoFailed(false);
  }, [item?.id, item?.logoUrl]);

  const dueAmount = detail?.dueAmount ?? item?.dueAmount ?? 0;
  const paymentsTotal = detail?.paymentsTotal ?? (detail?.payments ?? []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const remaining = detail?.remaining ?? Math.max(0, dueAmount - paymentsTotal);
  const statusTag = detail?.statusTag ?? "Unpaid";
  const statusDescription = detail?.statusDescription ?? "This payment is not yet paid.";
  const paymentKind = (detail?.kind ?? item?.kind ?? "payment").toString();
  const dueLabel = detail?.dueLabel ?? "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(16, insetsBottom),
              transform: [{ translateY: dragY }],
            },
          ]}
        >
          <View style={styles.sheetHandle} {...panHandlers} />

          <View style={styles.sheetTopBar} {...panHandlers}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClosePlain}>
              <Ionicons name="close" size={22} color={T.text} />
            </Pressable>
            <View style={{ flex: 1 }} />
          </View>

          <View style={styles.sheetHero} {...panHandlers}>
            <View style={styles.sheetAvatar}>
              {showLogo ? (
                <Image
                  source={{ uri: logoUri as string }}
                  style={styles.sheetAvatarLogo}
                  resizeMode="cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <Text style={styles.sheetAvatarText}>{heroInitial}</Text>
              )}
            </View>
            <Text style={styles.sheetHeroName} numberOfLines={1}>
              {heroName || "Payment"}
            </Text>
            <Text style={styles.sheetHeroAmt} numberOfLines={1}>
              {fmt(dueAmount, currency)}
            </Text>
            <Text style={styles.sheetHeroSub} numberOfLines={1}>
              {dueLabel}
            </Text>
          </View>

          <View style={styles.sheetCard}>
            <Text style={styles.sheetCardTitle}>Payment</Text>
            <View style={[styles.sheetCardRow, styles.sheetCardRowFirst]}>
              <Text style={styles.sheetCardLabel}>Type</Text>
              <Text style={styles.sheetCardValue}>
                {paymentKind === "debt" ? "Debt" : paymentKind === "expense" ? "Expense" : "Payment"}
              </Text>
            </View>
            <View style={styles.sheetCardRow}>
              <Text style={styles.sheetCardLabel}>Due</Text>
              <Text style={styles.sheetCardValue}>{dueLabel}</Text>
            </View>
            <View style={styles.sheetCardRow}>
              <Text style={styles.sheetCardLabel}>Paid so far</Text>
              <Text style={styles.sheetCardValue}>{fmt(paymentsTotal, currency)}</Text>
            </View>
            <View style={styles.sheetCardRow}>
              <Text style={styles.sheetCardLabel}>Remaining</Text>
              <Text style={styles.sheetCardValue}>{fmt(remaining, currency)}</Text>
            </View>
          </View>

          <View style={styles.sheetCard}>
            <Text style={styles.sheetCardTitle}>Status</Text>
            <View style={[styles.sheetCardRow, styles.sheetCardRowFirst]}>
              <Text style={styles.sheetCardLabel}>State</Text>
              <Text
                style={[
                  styles.sheetCardValue,
                  statusTag === "Paid"
                    ? styles.sheetCardValueGood
                    : statusTag === "Partial"
                      ? styles.sheetCardValueWarn
                      : styles.sheetCardValueBad,
                ]}
              >
                {statusTag}
              </Text>
            </View>
            <Text style={styles.sheetCardHint}>
              {statusDescription}
            </Text>
          </View>

          <View style={[styles.sheetCard, { flex: 1 }]}>
            <Text style={styles.sheetCardTitle}>Payment history</Text>
            {loading ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color={T.accent} />
              </View>
            ) : error ? (
              <View style={{ paddingVertical: 12 }}>
                <Text style={styles.sheetError}>{error}</Text>
                <Pressable
                  onPress={() => {
                    if (!item) return;
                    onRetry(item);
                  }}
                  style={styles.sheetRetryBtn}
                >
                  <Text style={styles.sheetRetryText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={detail?.payments ?? []}
                keyExtractor={(p) => p.id}
                contentContainerStyle={styles.sheetList}
                ListEmptyComponent={<Text style={styles.sheetEmpty}>No payments recorded yet.</Text>}
                renderItem={({ item: paymentItem }) => {
                  const d = new Date(paymentItem.date);
                  const dateLabel = Number.isNaN(d.getTime())
                    ? ""
                    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                  return (
                    <View style={styles.sheetPayRow}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={styles.sheetPayDate}>{dateLabel}</Text>
                        <Text style={styles.sheetPaySource}>{String(paymentItem.source ?? "").replaceAll("_", " ")}</Text>
                      </View>
                      <Text style={styles.sheetPayAmt}>{fmt(paymentItem.amount, currency)}</Text>
                    </View>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.sheetSep} />}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
