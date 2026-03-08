import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "./styles";

import { apiFetch } from "@/lib/api";
import type { Debt, Expense } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";
import { useCreateDebtPaymentMutation, useLazyGetDebtDetailQuery } from "@/store/api";
import { T } from "@/lib/theme";
import {
  computeDebtDueAmount,
  formatShortDate,
  isWithinPaymentEditGrace,
  PAYMENT_EDIT_GRACE_DAYS,
  unpaidDebtWarning,
} from "@/lib/domain/paymentRules";
import PaymentSheet from "@/components/Debts/Detail/PaymentSheet";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import { clearScheduledUnpaidReminders, notifyPaymentStatus, scheduleUnpaidFollowUpReminders, scheduleUnpaidReminder } from "@/lib/unpaidReminder";

const SHEET_BLUE = "#2a0a9e";

export type QuickPaymentActionItem = {
  kind: "expense" | "debt";
  id: string;
  name: string;
  amount: number;
  paidAmount?: number;
  lastPaymentAt?: string | null;
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

export default function QuickPaymentActionSheet({ visible, item, currency, insetsBottom, onClose, onUpdated }: Props) {
  const { dragY, panHandlers, resetDrag } = useSwipeDownToClose({ onClose });

  const [expense, setExpense] = useState<Expense | null>(null);
  const [debt, setDebt] = useState<Debt | null>(null);

  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [unpaidConfirmOpen, setUnpaidConfirmOpen] = useState(false);
  const itemId = useMemo(() => (item ? encodeURIComponent(item.id) : ""), [item]);
  const [fetchDebtDetail] = useLazyGetDebtDetailQuery();
  const [createDebtPayment] = useCreateDebtPaymentMutation();

  useEffect(() => {
    if (!visible) return;
    resetDrag();
    setPayAmount("");
    setPaySheetOpen(false);
    setUnpaidConfirmOpen(false);
    setExpense(null);
    setDebt(null);
  }, [resetDrag, visible]);

  const dueDays = useMemo(() => {
    const raw = expense?.dueDate ?? item?.dueDate;
    if (!raw) return null;
    const iso = String(raw).length >= 10 ? String(raw).slice(0, 10) : String(raw);
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return Math.round((d.getTime() - Date.now()) / 86_400_000);
  }, [expense?.dueDate, item?.dueDate]);

  const unpaidWarningText = useMemo(() => unpaidDebtWarning(dueDays), [dueDays]);

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

  const expensePaymentState = useMemo(() => {
    if (!item || item.kind !== "expense") {
      return { isPaid: false, canEditPaidPayment: false };
    }

    const amountNum = expense ? Number.parseFloat(String(expense.amount)) : item.amount;
    const paidNum = expense ? Number.parseFloat(String(expense.paidAmount)) : (item.paidAmount ?? 0);
    const isPaid = expense?.paid ?? (amountNum <= 0 ? true : paidNum >= amountNum - 0.005);
    const paidAt = expense?.lastPaymentAt ?? item.lastPaymentAt ?? null;
    const canEditPaidPayment = isPaid && isWithinPaymentEditGrace(paidAt);

    return { isPaid, canEditPaidPayment };
  }, [expense, item]);

  const canAct = useMemo(() => {
    if (!item) return false;
    if (item.kind === "expense") {
      return !expensePaymentState.isPaid || expensePaymentState.canEditPaidPayment;
    }

    const currentBal = debt ? Number.parseFloat(String(debt.currentBalance)) : null;
    if (currentBal == null) return true;
    return currentBal > 0.005;
  }, [debt, expensePaymentState, item]);

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

        void clearScheduledUnpaidReminders({ expenseId: e.id });

        void notifyPaymentStatus({
          expenseId: e.id,
          status: "paid",
          expenseName: e.name,
        });

        onClose();
        onUpdated();
        return;
      }

      const d = debt ?? (await fetchDebtDetail(item!.id, true).unwrap());
      setDebt(d);
      const currentBal = Number.parseFloat(String(d.currentBalance));
      if (!Number.isFinite(currentBal) || currentBal <= 0) {
        onClose();
        onUpdated();
        return;
      }

      const listDueAmount = Number.parseFloat(String(item.amount ?? 0));
      const computedDueAmount = computeDebtDueAmount(d);
      const dueNow = Number.isFinite(listDueAmount) && listDueAmount > 0 ? listDueAmount : computedDueAmount;
      const amountToApply = Math.min(currentBal, Math.max(0, dueNow));
      if (!(amountToApply > 0)) {
        onClose();
        onUpdated();
        return;
      }

      await createDebtPayment({ debtId: item!.id, amount: amountToApply }).unwrap();

      onClose();
      onUpdated();
    } catch (err: unknown) {
      Alert.alert("Update failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPaying(false);
    }
  }, [createDebtPayment, debt, expense, fetchDebtDetail, item, onClose, onUpdated, paying]);

  const markUnpaid = useCallback(async () => {
    if (!item || item.kind !== "expense" || paying) return;

    setPaying(true);
    try {
      await apiFetch<Expense>(`/api/bff/expenses/${itemId}`, {
        method: "PATCH",
        body: {
          paidAmount: 0,
          paid: false,
        },
      });

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const dueDate = expense?.dueDate ?? item.dueDate ?? null;

      void notifyPaymentStatus({
        expenseId: item.id,
        status: "unpaid",
        expenseName: item.name,
      });
      void scheduleUnpaidReminder({
        expenseId: item.id,
        expenseName: item.name,
      });
      void scheduleUnpaidFollowUpReminders({
        expenseId: item.id,
        expenseName: item.name,
        dueDate,
        month: currentMonth,
        year: currentYear,
        wasPreviouslyPaid: expensePaymentState.isPaid,
      });

      onClose();
      onUpdated();
    } catch (err: unknown) {
      Alert.alert("Update failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPaying(false);
    }
  }, [expense?.dueDate, expensePaymentState.isPaid, item, itemId, onClose, onUpdated, paying]);

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

      const d = debt ?? (await fetchDebtDetail(item!.id, true).unwrap());
      setDebt(d);
      const currentBal = Number.parseFloat(String(d.currentBalance));
      if (Number.isFinite(currentBal) && delta > currentBal) {
        Alert.alert("Amount too high", `Balance remaining is ${fmt(currentBal, currency)}.`);
        return;
      }

      await createDebtPayment({ debtId: item!.id, amount: delta }).unwrap();

      setPaySheetOpen(false);
      onClose();
      onUpdated();
    } catch (err: unknown) {
      Alert.alert("Payment failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPaying(false);
    }
  }, [createDebtPayment, currency, debt, expense, fetchDebtDetail, item, onClose, onUpdated, payAmount, paying]);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
        <View style={styles.overlay}>
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
            <View style={styles.handleTouch} {...panHandlers}>
              <View style={styles.handle} />
            </View>

            <View style={styles.hero}>
              <View style={styles.avatar}>
                {showLogo ? (
                  <Image source={{ uri: logoUri as string }} style={styles.avatarLogo} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarTxt}>{heroInitial}</Text>
                )}
              </View>

              <Text style={styles.name} numberOfLines={1}>
                {heroName || (item?.kind === "debt" ? "Debt" : "Expense")}
              </Text>
              <Text style={styles.amount} numberOfLines={1}>
                {fmt(item?.amount ?? 0, currency)}
              </Text>
              {dueLabel ? (
                <Text style={styles.sub} numberOfLines={1}>
                  {dueLabel}
                </Text>
              ) : null}
            </View>

            {canAct ? (
              <View style={styles.actionsRow}>
                {item?.kind === "expense" && expensePaymentState.isPaid ? (
                  <Pressable
                    onPress={() => setUnpaidConfirmOpen(true)}
                    disabled={paying}
                    style={[styles.actionBtn, styles.actionBtnSecondary, paying && styles.disabled]}
                  >
                    <Text style={styles.actionSecondaryTxt}>Mark as unpaid</Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable onPress={markPaid} disabled={paying} style={[styles.actionBtn, styles.actionBtnPrimary, paying && styles.disabled]}>
                      <Text style={styles.actionPrimaryTxt}>{item?.kind === "debt" ? "Mark due as paid" : "Mark as paid"}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (paying) return;
                        setPayAmount("");
                        setPaySheetOpen(true);
                      }}
                      disabled={paying}
                      style={[styles.actionBtn, styles.actionBtnSecondary, paying && styles.disabled]}
                    >
                      <Text style={styles.actionSecondaryTxt}>Record payment</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : (
              <Text style={styles.paidHint}>
                {item?.kind === "expense" ? `Paid (edits lock after ${PAYMENT_EDIT_GRACE_DAYS} days)` : "Paid"}
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

      <DeleteConfirmSheet
        visible={unpaidConfirmOpen}
        title="Mark as unpaid?"
        description={unpaidWarningText}
        confirmText="Unpaid"
        cancelText="Cancel"
        isBusy={paying}
        onClose={() => {
          if (paying) return;
          setUnpaidConfirmOpen(false);
        }}
        onConfirm={async () => {
          setUnpaidConfirmOpen(false);
          await markUnpaid();
        }}
      />
    </>
  );
}
