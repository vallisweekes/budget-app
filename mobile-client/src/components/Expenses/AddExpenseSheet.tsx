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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import type { ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";
import { resolveCategoryColor } from "@/lib/categoryColors";

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

// ─── Category picker mini-row ─────────────────────────────────────────────────

function CategoryRow({
  categories,
  value,
  onChange,
}: {
  categories: ExpenseCategoryBreakdown[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={pr.row}
      keyboardShouldPersistTaps="handled"
    >
      {/* None / Misc option */}
      <Pressable
        style={[pr.pill, value === "" && pr.pillSelected]}
        onPress={() => onChange("")}
      >
        <Text style={[pr.pillTxt, value === "" && pr.pillTxtSelected]}>None</Text>
      </Pressable>

      {categories.map((c) => {
        const active = value === c.categoryId;
        const color = resolveCategoryColor(c.color);
        return (
          <Pressable
            key={c.categoryId}
            style={[pr.pill, active && { borderColor: color, backgroundColor: color + "22" }]}
            onPress={() => onChange(c.categoryId)}
          >
            <View style={[pr.dot, { backgroundColor: color }]} />
            <Text
              style={[pr.pillTxt, active && { color: color, fontWeight: "900" }]}
              numberOfLines={1}
            >
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
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
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

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

      await apiFetch("/api/bff/expenses", { method: "POST", body: JSON.stringify(body) });
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
          <View style={s.header}>
            <View>
              <Text style={s.title}>Add Expense</Text>
              <Text style={s.sub}>
                {new Date(year, month - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={T.textDim} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.formScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Name */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Expense name</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Netflix, Rent…"
                placeholderTextColor={T.textMuted}
                selectionColor={T.accent}
                returnKeyType="next"
                autoCapitalize="words"
              />
            </View>

            {/* Amount */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Amount ({currency})</Text>
              <TextInput
                style={s.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={T.textMuted}
                selectionColor={T.accent}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>

            {/* Category */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Category</Text>
              <CategoryRow
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
              />
            </View>

            {/* Due date (optional) */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Due date <Text style={s.optional}>(optional)</Text></Text>
              <TextInput
                style={s.input}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={T.textMuted}
                selectionColor={T.accent}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
              />
            </View>

            {/* Paid toggle */}
            <View style={s.toggleRow}>
              <View style={s.toggleInfo}>
                <Text style={s.toggleTitle}>Mark as paid</Text>
                <Text style={s.toggleSub}>Expense is already settled</Text>
              </View>
              <TouchableOpacity
                onPress={() => setPaid((v) => !v)}
                style={[s.toggle, paid && s.toggleOn]}
                activeOpacity={0.8}
              >
                <View style={[s.toggleThumb, paid && s.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            {/* Allocation toggle */}
            <View style={s.toggleRow}>
              <View style={s.toggleInfo}>
                <Text style={s.toggleTitle}>Allocation payment</Text>
                <Text style={s.toggleSub}>For envelopes like groceries — never becomes a debt</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAllocation((v) => !v)}
                style={[s.toggle, isAllocation && s.toggleOn]}
                activeOpacity={0.8}
              >
                <View style={[s.toggleThumb, isAllocation && s.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            {/* Direct Debit toggle */}
            <View style={s.toggleRow}>
              <View style={s.toggleInfo}>
                <Text style={s.toggleTitle}>Direct Debit / Standing Order</Text>
                <Text style={s.toggleSub}>Automatically collected each month</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsDirectDebit((v) => !v)}
                style={[s.toggle, isDirectDebit && s.toggleOn]}
                activeOpacity={0.8}
              >
                <View style={[s.toggleThumb, isDirectDebit && s.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            {/* Distribute remaining months toggle */}
            <View style={s.toggleRow}>
              <View style={s.toggleInfo}>
                <Text style={s.toggleTitle}>Distribute remaining months</Text>
                <Text style={s.toggleSub}>Add to every month from now through December</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDistributeMonths((v) => !v)}
                style={[s.toggle, distributeMonths && s.toggleOn]}
                activeOpacity={0.8}
              >
                <View style={[s.toggleThumb, distributeMonths && s.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            {/* Distribute across years toggle (available when distributeMonths is on) */}
            {distributeMonths ? (
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.toggleTitle}>Repeat next year too</Text>
                  <Text style={s.toggleSub}>Also distribute across the same months next year</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDistributeYears((v) => !v)}
                  style={[s.toggle, distributeYears && s.toggleOn]}
                  activeOpacity={0.8}
                >
                  <View style={[s.toggleThumb, distributeYears && s.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Error */}
            {error ? (
              <View style={s.errorRow}>
                <Ionicons name="warning-outline" size={14} color={T.red} />
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <Pressable
              style={[s.submitBtn, (!canSubmit || submitting) && s.submitDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <Text style={s.submitTxt}>Adding…</Text>
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={18} color={T.onAccent} />
                  <Text style={s.submitTxt}>Add Expense</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.92,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: T.border,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  title: { color: T.text, fontSize: 18, fontWeight: "900" },
  sub: { color: T.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  closeBtn: {
    backgroundColor: T.cardAlt,
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: T.border,
  },

  formScroll: { padding: 20, gap: 18 },

  fieldGroup: { gap: 8 },
  label: { color: T.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  optional: { color: T.textMuted, fontWeight: "600" },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: T.text,
    fontSize: 15,
    fontWeight: "700",
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...cardBase,
    padding: 16,
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  toggleTitle: { color: T.text, fontSize: 14, fontWeight: "800" },
  toggleSub: { color: T.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: T.accent + "55",
    borderColor: T.accent,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: T.textMuted,
    alignSelf: "flex-start",
  },
  toggleThumbOn: {
    backgroundColor: T.accent,
    alignSelf: "flex-end",
  },

  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: T.red + "18",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: T.red + "44",
  },
  errorTxt: { color: T.red, fontSize: 13, fontWeight: "700", flex: 1 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  submitDisabled: { opacity: 0.45 },
  submitTxt: { color: T.onAccent, fontSize: 16, fontWeight: "900" },
});

const pr = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  pillSelected: {
    backgroundColor: T.accentDim,
    borderColor: T.accent,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillTxt: { color: T.textDim, fontSize: 13, fontWeight: "700" },
  pillTxtSelected: { color: T.text, fontWeight: "900" },
});
