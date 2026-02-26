/**
 * AddExpenseSheet
 *
 * Bottom sheet that slides almost to the top of the screen.
 * Fields: Name · Amount · Category · Paid toggle · Due date (optional)
 * Calls POST /api/bff/expenses then triggers onAdded so the parent can refresh.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { ADD_EXPENSE_SHEET_SCREEN_H, s } from "@/components/Expenses/AddExpenseSheet.styles";
import AddExpenseSheetFields from "@/components/Expenses/AddExpenseSheetFields";
import AddExpenseSheetToggles from "@/components/Expenses/AddExpenseSheetToggles";
import AddExpenseSheetFooter from "@/components/Expenses/AddExpenseSheetFooter";
import AddExpenseSheetHeader from "@/components/Expenses/AddExpenseSheetHeader";

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  month: number;
  year: number;
  budgetPlanId?: string | null;
  currency: string;
  categories: ExpenseCategoryBreakdown[];
  /** Called after a successfull add so the parent can refresh */
  onAdded: () => void;
  onClose: () => void;
}

// ─── Sheet ───────────────────────────────────────────────────────────────────

export default function AddExpenseSheet({
  visible,
  month,
  year,
  budgetPlanId,
  currency,
  categories,
  onAdded,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(ADD_EXPENSE_SHEET_SCREEN_H ?? SCREEN_H)).current;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paid, setPaid] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [isAllocation, setIsAllocation] = useState(false);
  const [isDirectDebit, setIsDirectDebit] = useState(false);
  const [distributeMonths, setDistributeMonths] = useState(false);
  const [distributeYears, setDistributeYears] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animate in / out
  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      bounciness: 3,
      speed: 18,
    }).start();
    if (!visible) {
      // Reset form on close
      setTimeout(() => {
        setName("");
        setAmount("");
        setCategoryId("");
        setPaid(false);
        setDueDate("");
        setIsAllocation(false);
        setIsDirectDebit(false);
        setDistributeMonths(false);
        setDistributeYears(false);
        setError(null);
      }, 300);
    }
  }, [visible]);

  const canSubmit = name.trim().length > 0 && parseFloat(amount) > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        amount: parseFloat(amount),
        month,
        year,
        paid,
        isAllocation,
        isDirectDebit,
        distributeMonths,
        distributeYears,
      };
      if (categoryId) body.categoryId = categoryId;
      if (dueDate.trim()) body.dueDate = dueDate.trim();
      if (budgetPlanId) body.budgetPlanId = budgetPlanId;

      await apiFetch("/api/bff/expenses", { method: "POST", body });
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add expense. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Backdrop */}
        <Pressable style={s.backdrop} onPress={onClose} />

        {/* Sheet */}
        <Animated.View
          style={[
            s.sheet,
            { paddingBottom: insets.bottom + 24, transform: [{ translateY: slideY }] },
          ]}
        >
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <AddExpenseSheetHeader month={month} year={year} onClose={onClose} />

          {/* Scrollable body: fields + toggles */}
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <AddExpenseSheetFields
              name={name}
              setName={setName}
              amount={amount}
              setAmount={setAmount}
              categoryId={categoryId}
              setCategoryId={setCategoryId}
              dueDate={dueDate}
              setDueDate={setDueDate}
              categories={categories}
              currency={currency}
            />

            <View style={{ paddingHorizontal: 20, gap: 18 }}>
              <AddExpenseSheetToggles
                paid={paid}
                setPaid={setPaid}
                isAllocation={isAllocation}
                setIsAllocation={setIsAllocation}
                isDirectDebit={isDirectDebit}
                setIsDirectDebit={setIsDirectDebit}
                distributeMonths={distributeMonths}
                setDistributeMonths={setDistributeMonths}
                distributeYears={distributeYears}
                setDistributeYears={setDistributeYears}
              />
            </View>
          </ScrollView>

          {/* Footer pinned below the scroll */}
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <AddExpenseSheetFooter
              error={error}
              canSubmit={canSubmit}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
