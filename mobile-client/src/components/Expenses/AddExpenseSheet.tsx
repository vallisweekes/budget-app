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
import type { BudgetPlanListItem, Category, CreditCard, ExpenseCategoryBreakdown, ExpensePaymentSource } from "@/lib/apiTypes";
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
  plans?: BudgetPlanListItem[];
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
  plans = [],
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
  // Internal month/year — user can change inside the sheet
  const [sheetMonth, setSheetMonth] = useState(month);
  const [sheetYear, setSheetYear] = useState(year);

  // Sync sheet month/year when the prop changes (e.g. parent navigates)
  useEffect(() => { setSheetMonth(month); setSheetYear(year); }, [month, year]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const canGoBack = sheetYear > currentYear || (sheetYear === currentYear && sheetMonth > currentMonth);

  const handlePrevMonth = () => {
    if (!canGoBack) return;
    if (sheetMonth === 1) { setSheetMonth(12); setSheetYear((y) => y - 1); }
    else setSheetMonth((m) => m - 1);
  };
  const handleNextMonth = () => {
    if (sheetMonth === 12) { setSheetMonth(1); setSheetYear((y) => y + 1); }
    else setSheetMonth((m) => m + 1);
  };
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(budgetPlanId ?? null);
  const [planCategories, setPlanCategories] = useState<ExpenseCategoryBreakdown[] | null>(null);
  const [paymentSource, setPaymentSource] = useState<ExpensePaymentSource>("income");
  const [cardDebtId, setCardDebtId] = useState("");
  const [cards, setCards] = useState<CreditCard[]>([]);

  // Sync selectedPlanId when budgetPlanId prop changes (e.g. parent switches plan)
  useEffect(() => {
    setSelectedPlanId(budgetPlanId ?? null);
    setPlanCategories(null);
  }, [budgetPlanId]);
  const [isAllocation, setIsAllocation] = useState(false);
  const [isDirectDebit, setIsDirectDebit] = useState(false);
  const [distributeMonths, setDistributeMonths] = useState(false);
  const [distributeYears, setDistributeYears] = useState(false);

  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
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
        setSheetMonth(month);
        setSheetYear(year);
        setPaymentSource("income");
        setCardDebtId("");
        setSelectedPlanId(budgetPlanId ?? null);
        setPlanCategories(null);
        setPlanDropdownOpen(false);
        setIsAllocation(false);
        setIsDirectDebit(false);
        setDistributeMonths(false);
        setDistributeYears(false);
        setError(null);
      }, 300);
    }
  }, [visible]);

  // Resolve the plan id to use: prefer what the user picked in the sheet
  const effectivePlanId = selectedPlanId ?? budgetPlanId ?? null;

  // Fetch categories whenever the user picks a plan different from the parent plan
  useEffect(() => {
    if (!visible) return;
    if (effectivePlanId === budgetPlanId) {
      setPlanCategories(null); // use prop categories
      return;
    }
    if (!effectivePlanId) return;
    void (async () => {
      try {
        const data = await apiFetch<Category[]>(
          `/api/bff/categories?budgetPlanId=${encodeURIComponent(effectivePlanId)}`
        );
        if (Array.isArray(data)) {
          setPlanCategories(
            data.map((c) => ({
              categoryId: c.id,
              name: c.name,
              color: c.color,
              icon: c.icon,
              total: 0,
              paidTotal: 0,
              paidCount: 0,
              totalCount: 0,
            }))
          );
          // Reset category since the old catId won't exist in the new plan
          setCategoryId("");
        }
      } catch {
        setPlanCategories(null);
      }
    })();
  }, [visible, effectivePlanId, budgetPlanId]);

  // Fetch credit cards so the Source of Funds picker can show card names
  useEffect(() => {
    if (!visible) return;
    void (async () => {
      try {
        const params = effectivePlanId ? `?budgetPlanId=${encodeURIComponent(effectivePlanId)}` : "";
        const data = await apiFetch<CreditCard[]>(`/api/bff/credit-cards${params}`);
        setCards(Array.isArray(data) ? data : []);
      } catch {
        setCards([]);
      }
    })();
  }, [visible, effectivePlanId]);

  const canSubmit = name.trim().length > 0 && parseFloat(amount) > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        amount: parseFloat(amount),
        month: sheetMonth,
        year: sheetYear,
        paid,
        isAllocation,
        isDirectDebit,
        distributeMonths,
        distributeYears,
        paymentSource: paymentSource === "other" ? "extra_untracked" : paymentSource,
      };
      if (categoryId) body.categoryId = categoryId;
      if (dueDate.trim()) body.dueDate = dueDate.trim();
      if (effectivePlanId) body.budgetPlanId = effectivePlanId;
      if (paymentSource === "credit_card" && cardDebtId) body.cardDebtId = cardDebtId;

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
          <AddExpenseSheetHeader
            month={sheetMonth}
            year={sheetYear}
            canPrev={canGoBack}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onClose={onClose}
          />

          {/* Plan picker — compact dropdown shown only when user has multiple plans */}
          {plans.length > 1 && (
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, zIndex: 10 }}>
              <Pressable
                onPress={() => setPlanDropdownOpen((o) => !o)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: planDropdownOpen ? T.accent : T.border,
                  backgroundColor: T.card,
                }}
              >
                <Text style={{ fontSize: 14, color: T.text, flex: 1 }} numberOfLines={1}>
                  {plans.find((p) => p.id === effectivePlanId)?.name ?? "Select plan"}
                </Text>
                <Ionicons
                  name={planDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={T.textMuted}
                />
              </Pressable>

              {planDropdownOpen && (
                <View
                  style={{
                    position: "absolute",
                    top: 46,
                    left: 20,
                    right: 20,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: T.border,
                    backgroundColor: T.card,
                    overflow: "hidden",
                    zIndex: 20,
                    shadowColor: "#000",
                    shadowOpacity: 0.18,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 8,
                  }}
                >
                  {plans.map((p, idx) => {
                    const active = effectivePlanId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => { setSelectedPlanId(p.id); setPlanDropdownOpen(false); }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          backgroundColor: active ? T.accent + "22" : "transparent",
                          borderTopWidth: idx === 0 ? 0 : 1,
                          borderTopColor: T.border,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: active ? "600" : "400",
                            color: active ? T.accent : T.text,
                          }}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                        {active && <Ionicons name="checkmark" size={16} color={T.accent} />}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

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
              paymentSource={paymentSource}
              setPaymentSource={setPaymentSource}
              cardDebtId={cardDebtId}
              setCardDebtId={setCardDebtId}
              cards={cards}
              categories={planCategories ?? categories}
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
