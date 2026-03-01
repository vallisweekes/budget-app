import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { fmt } from "@/lib/formatting";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { T } from "@/lib/theme";
import { CARD_RADIUS, cardBase } from "@/lib/ui";
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

function formatDueLabel(detail: PaymentDetail | null): string {
  if (!detail) return "";
  if (detail.dueDate) {
    const d = new Date(detail.dueDate);
    if (!Number.isNaN(d.getTime())) {
      return `Due ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    }
  }
  if (typeof detail.dueDay === "number" && Number.isFinite(detail.dueDay)) {
    return `Due day ${detail.dueDay}`;
  }
  return "Due date not set";
}

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
  const paymentsTotal = useMemo(
    () => (detail?.payments ?? []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
    [detail?.payments]
  );
  const remaining = Math.max(0, dueAmount - paymentsTotal);
  const paymentKind = (detail?.kind ?? item?.kind ?? "payment").toString();

  const isPaid = dueAmount <= 0 ? true : paymentsTotal >= dueAmount - 0.005;
  const isPartial = !isPaid && paymentsTotal > 0;
  const missedState = detail?.isMissedPayment || detail?.missed;
  const statusTag = missedState
    ? "Missed"
    : detail?.overdue
      ? "Overdue"
      : isPaid
        ? "Paid"
        : isPartial
          ? "Partial"
          : "Unpaid";

  const statusDescription = missedState
    ? "This payment is marked as missed."
    : detail?.overdue
      ? "This payment is overdue."
      : isPaid
        ? "This payment is paid in full."
        : isPartial
          ? "This payment has been paid partially."
          : "This payment is not yet paid.";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={s.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            s.sheet,
            {
              paddingBottom: Math.max(16, insetsBottom),
              transform: [{ translateY: dragY }],
            },
          ]}
        >
          <View style={s.sheetHandle} {...panHandlers} />

          <View style={s.sheetTopBar} {...panHandlers}>
            <Pressable onPress={onClose} hitSlop={10} style={s.sheetClosePlain}>
              <Ionicons name="close" size={22} color={T.text} />
            </Pressable>
            <View style={{ flex: 1 }} />
          </View>

          <View style={s.sheetHero} {...panHandlers}>
            <View style={s.sheetAvatar}>
              {showLogo ? (
                <Image
                  source={{ uri: logoUri as string }}
                  style={s.sheetAvatarLogo}
                  resizeMode="cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <Text style={s.sheetAvatarText}>{heroInitial}</Text>
              )}
            </View>
            <Text style={s.sheetHeroName} numberOfLines={1}>
              {heroName || "Payment"}
            </Text>
            <Text style={s.sheetHeroAmt} numberOfLines={1}>
              {fmt(dueAmount, currency)}
            </Text>
            <Text style={s.sheetHeroSub} numberOfLines={1}>
              {detail ? formatDueLabel(detail) : ""}
            </Text>
          </View>

          <View style={s.sheetCard}>
            <Text style={s.sheetCardTitle}>Payment</Text>
            <View style={[s.sheetCardRow, s.sheetCardRowFirst]}>
              <Text style={s.sheetCardLabel}>Type</Text>
              <Text style={s.sheetCardValue}>
                {paymentKind === "debt" ? "Debt" : paymentKind === "expense" ? "Expense" : "Payment"}
              </Text>
            </View>
            <View style={s.sheetCardRow}>
              <Text style={s.sheetCardLabel}>Due</Text>
              <Text style={s.sheetCardValue}>{detail ? formatDueLabel(detail) : ""}</Text>
            </View>
            <View style={s.sheetCardRow}>
              <Text style={s.sheetCardLabel}>Paid so far</Text>
              <Text style={s.sheetCardValue}>{fmt(paymentsTotal, currency)}</Text>
            </View>
            <View style={s.sheetCardRow}>
              <Text style={s.sheetCardLabel}>Remaining</Text>
              <Text style={s.sheetCardValue}>{fmt(remaining, currency)}</Text>
            </View>
          </View>

          <View style={s.sheetCard}>
            <Text style={s.sheetCardTitle}>Status</Text>
            <View style={[s.sheetCardRow, s.sheetCardRowFirst]}>
              <Text style={s.sheetCardLabel}>State</Text>
              <Text
                style={[
                  s.sheetCardValue,
                  statusTag === "Paid"
                    ? s.sheetCardValueGood
                    : statusTag === "Partial"
                      ? s.sheetCardValueWarn
                      : s.sheetCardValueBad,
                ]}
              >
                {statusTag}
              </Text>
            </View>
            <Text style={s.sheetCardHint}>
              {statusDescription}
            </Text>
          </View>

          <View style={[s.sheetCard, { flex: 1 }]}>
            <Text style={s.sheetCardTitle}>Payment history</Text>
            {loading ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color={T.accent} />
              </View>
            ) : error ? (
              <View style={{ paddingVertical: 12 }}>
                <Text style={s.sheetError}>{error}</Text>
                <Pressable
                  onPress={() => {
                    if (!item) return;
                    onRetry(item);
                  }}
                  style={s.sheetRetryBtn}
                >
                  <Text style={s.sheetRetryText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={detail?.payments ?? []}
                keyExtractor={(p) => p.id}
                contentContainerStyle={s.sheetList}
                ListEmptyComponent={<Text style={s.sheetEmpty}>No payments recorded yet.</Text>}
                renderItem={({ item: paymentItem }) => {
                  const d = new Date(paymentItem.date);
                  const dateLabel = Number.isNaN(d.getTime())
                    ? ""
                    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                  return (
                    <View style={s.sheetPayRow}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={s.sheetPayDate}>{dateLabel}</Text>
                        <Text style={s.sheetPaySource}>{String(paymentItem.source ?? "").replaceAll("_", " ")}</Text>
                      </View>
                      <Text style={s.sheetPayAmt}>{fmt(paymentItem.amount, currency)}</Text>
                    </View>
                  );
                }}
                ItemSeparatorComponent={() => <View style={s.sheetSep} />}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "92%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.border,
    marginBottom: 10,
  },
  sheetTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingBottom: 6,
  },
  sheetClosePlain: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  sheetHero: {
    paddingTop: 6,
    paddingBottom: 8,
    alignItems: "center",
  },
  sheetAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 10,
  },
  sheetAvatarLogo: {
    width: "100%",
    height: "100%",
  },
  sheetAvatarText: {
    color: T.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  sheetHeroName: {
    color: T.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  sheetHeroAmt: {
    marginTop: 6,
    color: T.text,
    fontSize: 38,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.6,
  },
  sheetHeroSub: {
    marginTop: 6,
    color: T.textDim,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  sheetCard: {
    marginTop: 12,
    ...cardBase,
    backgroundColor: T.cardAlt,
    borderRadius: CARD_RADIUS,
    padding: 12,
  },
  sheetCardTitle: {
    marginBottom: 10,
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
  },
  sheetCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  sheetCardRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  sheetCardLabel: { color: T.textDim, fontSize: 13, fontWeight: "800" },
  sheetCardValue: { color: T.text, fontSize: 13, fontWeight: "900" },
  sheetCardValueGood: { color: T.green },
  sheetCardValueWarn: { color: T.orange },
  sheetCardValueBad: { color: T.red },
  sheetCardHint: {
    marginTop: 8,
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  sheetError: { color: T.red, fontSize: 13, fontWeight: "700" },
  sheetRetryBtn: {
    marginTop: 10,
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  sheetRetryText: { color: T.onAccent, fontWeight: "800" },
  sheetList: { paddingBottom: 18 },
  sheetEmpty: { color: T.textDim, fontSize: 13, fontStyle: "italic", paddingVertical: 12 },
  sheetPayRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  sheetPayDate: { color: T.text, fontSize: 14, fontWeight: "800" },
  sheetPaySource: { color: T.textDim, fontSize: 12, fontWeight: "700", marginTop: 2 },
  sheetPayAmt: { color: T.text, fontSize: 14, fontWeight: "900" },
  sheetSep: { height: StyleSheet.hairlineWidth, backgroundColor: T.border },
});
