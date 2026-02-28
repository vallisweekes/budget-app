import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { apiFetch } from "@/lib/api";
import type { Debt, Expense } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";
import { T } from "@/lib/theme";
import PaymentSheet from "@/components/Debts/Detail/PaymentSheet";

const SHEET_BLUE = "#2a0a9e";

export type QuickPaymentActionItem = {
  kind: "expense" | "debt";
  id: string;
  name: string;
  amount: number;
  paidAmount?: number;
  logoUrl?: string | null;
  dueDate?: string | null;
  subtitle?: string | null;
};

type Props = {
  visible: boolean;
  item: QuickPaymentActionItem | null;
  currency: string;
  insetsBottom: number;
  onClose: () => void;
  onUpdated: () => void;
};

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function QuickPaymentActionSheet({ visible, item, currency, insetsBottom, onClose, onUpdated }: Props) {
  const { dragY, panHandlers, resetDrag } = useSwipeDownToClose({ onClose });

  const [expense, setExpense] = useState<Expense | null>(null);
  const [debt, setDebt] = useState<Debt | null>(null);

  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const itemId = useMemo(() => (item ? encodeURIComponent(item.id) : ""), [item]);

  useEffect(() => {
    if (!visible) return;
    resetDrag();
    setPayAmount("");
    setPaySheetOpen(false);
    setExpense(null);
    setDebt(null);
  }, [resetDrag, visible]);

  const heroName = String(item?.name ?? "").trim();
  const heroInitial = (heroName?.[0] ?? "?").toUpperCase();
  const logoUri = useMemo(() => resolveLogoUri(item?.logoUrl), [item?.logoUrl]);
  const showLogo = Boolean(logoUri);

  const dueLabel = useMemo(() => {
    const formatted = formatShortDate(item?.dueDate);
    if (formatted) return `Next on ${formatted}`;
    const subtitle = String(item?.subtitle ?? "").trim();
    return subtitle || "";
  }, [item?.dueDate, item?.subtitle]);

  const canAct = useMemo(() => {
    if (!item) return false;
    if (item.kind === "expense") {
      const amountNum = expense ? Number.parseFloat(String(expense.amount)) : item.amount;
      const paidNum = expense ? Number.parseFloat(String(expense.paidAmount)) : (item.paidAmount ?? 0);
      const isPaid = expense?.paid ?? (amountNum <= 0 ? true : paidNum >= amountNum - 0.005);
      return !isPaid;
    }

    const currentBal = debt ? Number.parseFloat(String(debt.currentBalance)) : null;
    if (currentBal == null) return true;
    return currentBal > 0.005;
  }, [debt, expense, item]);

  const markPaid = useCallback(async () => {
    if (!item || paying) return;

    setPaying(true);
    try {
      if (item.kind === "expense") {
        const e = expense ?? (await apiFetch<Expense>(`/api/bff/expenses/${itemId}`));
        const amountNum = Number.parseFloat(String(e.amount));
        if (!Number.isFinite(amountNum)) return;

        const body: Record<string, unknown> = {
          paidAmount: amountNum,
          paid: true,
        };
        if (e.paymentSource && e.paymentSource !== "income") {
          body.paymentSource = e.paymentSource;
          if (e.cardDebtId) body.cardDebtId = e.cardDebtId;
        }

        await apiFetch<Expense>(`/api/bff/expenses/${itemId}`, {
          method: "PATCH",
          body,
        });

        onClose();
        onUpdated();
        return;
      }

      const d = debt ?? (await apiFetch<Debt>(`/api/bff/debts/${itemId}`));
      const currentBal = Number.parseFloat(String(d.currentBalance));
      if (!Number.isFinite(currentBal) || currentBal <= 0) {
        onClose();
        onUpdated();
        return;
      }

      await apiFetch(`/api/bff/debts/${itemId}/payments`, { method: "POST", body: { amount: currentBal } });

      onClose();
      onUpdated();
    } catch (err: unknown) {
      Alert.alert("Update failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPaying(false);
    }
  }, [debt, expense, item, itemId, onClose, onUpdated, paying]);

  const savePayment = useCallback(async () => {
    if (!item || paying) return;

    const delta = Number.parseFloat(String(payAmount ?? ""));
    if (!Number.isFinite(delta) || delta <= 0) return;

    setPaying(true);
    try {
      if (item.kind === "expense") {
        const e = expense ?? (await apiFetch<Expense>(`/api/bff/expenses/${itemId}`));
        const amountNum = Number.parseFloat(String(e.amount));
        const paidNum = Number.parseFloat(String(e.paidAmount));
        if (!Number.isFinite(amountNum) || !Number.isFinite(paidNum)) return;

        const nextPaid = Math.min(amountNum, paidNum + delta);
        const nextIsPaid = nextPaid >= amountNum - 0.005;

        const body: Record<string, unknown> = {
          paidAmount: nextPaid,
          paid: nextIsPaid,
        };
        if (nextIsPaid && e.paymentSource && e.paymentSource !== "income") {
          body.paymentSource = e.paymentSource;
          if (e.cardDebtId) body.cardDebtId = e.cardDebtId;
        }

        await apiFetch<Expense>(`/api/bff/expenses/${itemId}`, {
          method: "PATCH",
          body,
        });

        setPaySheetOpen(false);
        onClose();
        onUpdated();
        return;
      }

      const d = debt ?? (await apiFetch<Debt>(`/api/bff/debts/${itemId}`));
      const currentBal = Number.parseFloat(String(d.currentBalance));
      if (Number.isFinite(currentBal) && delta > currentBal) {
        Alert.alert("Amount too high", `Balance remaining is ${fmt(currentBal, currency)}.`);
        return;
      }

      await apiFetch(`/api/bff/debts/${itemId}/payments`, { method: "POST", body: { amount: delta } });

      setPaySheetOpen(false);
      onClose();
      onUpdated();
    } catch (err: unknown) {
      Alert.alert("Payment failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPaying(false);
    }
  }, [currency, debt, expense, item, itemId, onClose, onUpdated, payAmount, paying]);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
        <View style={s.overlay}>
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
            <View style={s.handleTouch} {...panHandlers}>
              <View style={s.handle} />
            </View>

            <View style={s.hero}>
              <View style={s.avatar}>
                {showLogo ? (
                  <Image source={{ uri: logoUri as string }} style={s.avatarLogo} resizeMode="cover" />
                ) : (
                  <Text style={s.avatarTxt}>{heroInitial}</Text>
                )}
              </View>

              <Text style={s.name} numberOfLines={1}>
                {heroName || (item?.kind === "debt" ? "Debt" : "Expense")}
              </Text>
              <Text style={s.amount} numberOfLines={1}>
                {fmt(item?.amount ?? 0, currency)}
              </Text>
              {dueLabel ? (
                <Text style={s.sub} numberOfLines={1}>
                  {dueLabel}
                </Text>
              ) : null}
            </View>

            {canAct ? (
              <View style={s.actionsRow}>
                <Pressable onPress={markPaid} disabled={paying} style={[s.actionBtn, s.actionBtnPrimary, paying && s.disabled]}>
                  <Text style={s.actionPrimaryTxt}>Mark as paid</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (paying) return;
                    setPayAmount("");
                    setPaySheetOpen(true);
                  }}
                  disabled={paying}
                  style={[s.actionBtn, s.actionBtnSecondary, paying && s.disabled]}
                >
                  <Text style={s.actionSecondaryTxt}>Record payment</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={s.paidHint}>
                Paid
              </Text>
            )}
          </Animated.View>
        </View>
      </Modal>

      <PaymentSheet
        visible={paySheetOpen}
        currency={currency}
        payAmount={payAmount}
        paying={paying}
        onChangeAmount={setPayAmount}
        onClose={() => {
          if (paying) return;
          setPaySheetOpen(false);
        }}
        onSave={savePayment}
        showMarkPaid={false}
      />
    </>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    backgroundColor: SHEET_BLUE,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "92%",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    backgroundColor: T.border,
  },
  handleTouch: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 10,
    marginBottom: 2,
  },
  hero: { alignItems: "center", paddingTop: 6, paddingBottom: 6 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: T.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarTxt: { color: T.text, fontSize: 16, fontWeight: "900" },
  avatarLogo: { width: "100%", height: "100%" },
  name: { color: T.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
  amount: { color: T.text, fontSize: 34, fontWeight: "900", letterSpacing: -0.7, marginTop: 6 },
  sub: { color: T.textDim, fontSize: 13, fontWeight: "700", marginTop: 8 },

  loadingRow: { paddingVertical: 10, alignItems: "center" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 10 },
  actionBtn: { flex: 1, borderRadius: 999, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  actionBtnPrimary: { backgroundColor: "#ffffff" },
  actionBtnSecondary: { backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border },
  actionPrimaryTxt: { color: SHEET_BLUE, fontSize: 14, fontWeight: "900" },
  actionSecondaryTxt: { color: T.text, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.55 },

  paidHint: { marginTop: 16, marginBottom: 6, color: T.green, fontSize: 13, fontWeight: "900", textAlign: "center" },
});
