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
  Keyboard,
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
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";
import type {
  BudgetPlanListItem,
  Category,
  CreditCard,
  ExpenseCategoryBreakdown,
  ExpensePaymentSource,
  ExpenseSuggestion,
} from "@/lib/apiTypes";
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
  initialCategoryId?: string;
  headerTitle?: string;
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
  initialCategoryId,
  headerTitle,
  plans = [],
  currency,
  categories,
  onAdded,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(ADD_EXPENSE_SHEET_SCREEN_H ?? SCREEN_H)).current;

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? "");
	const [categoryTouched, setCategoryTouched] = useState(false);
  const categoryTouchedRef = useRef(false);
  const categoryIdRef = useRef("");
	const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const suggestSeqRef = useRef(0);
  const [expenseSuggestions, setExpenseSuggestions] = useState<ExpenseSuggestion[]>([]);
  const [expenseSuggestionsLoading, setExpenseSuggestionsLoading] = useState(false);
  const expenseSuggestionsSeqRef = useRef(0);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [dueDate, setDueDate] = useState("");
  // Internal month/year — user can change inside the sheet
  const [sheetMonth, setSheetMonth] = useState(month);
  const [sheetYear, setSheetYear] = useState(year);

  // Sync sheet month/year when the prop changes (e.g. parent navigates)
  useEffect(() => { setSheetMonth(month); setSheetYear(year); }, [month, year]);
	useEffect(() => { categoryTouchedRef.current = categoryTouched; }, [categoryTouched]);
	useEffect(() => { categoryIdRef.current = categoryId; }, [categoryId]);

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

  const { dragY, panHandlers } = useSwipeDownToClose({ onClose, disabled: submitting });

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // Animate in / out
  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      bounciness: 3,
      speed: 18,
    }).start();
    if (visible) {
      setCategoryId(initialCategoryId ?? "");
			setCategoryTouched(false);
    }
    if (!visible) {
      // Reset form on close
      setTimeout(() => {
        setName("");
        setAmount("");
        setCategoryId(initialCategoryId ?? "");
			setCategoryTouched(false);
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
  }, [visible, initialCategoryId, month, year, budgetPlanId]);

  // Resolve the plan id to use: prefer what the user picked in the sheet
  const effectivePlanId = selectedPlanId ?? budgetPlanId ?? null;

  const handleManualCategoryChange = (nextId: string) => {
    setCategoryTouched(true);
    setCategoryId(nextId);
    setSelectedSeriesKey(null);
  };

  const handleManualNameChange = (next: string) => {
    setName(next);
    setSelectedSeriesKey(null);
  };

  const handleManualAmountChange = (next: string) => {
    setAmount(next);
    setSelectedSeriesKey(null);
  };

  useEffect(() => {
    if (!visible) return;
    if (categoryTouched) return;
    if (categoryId) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    if (!effectivePlanId) return;

    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(async () => {
      const seq = ++suggestSeqRef.current;
      try {
        const res = await apiFetch<{ categoryId: string | null }>("/api/bff/expenses/suggest-category", {
          method: "POST",
          body: { expenseName: trimmed, budgetPlanId: effectivePlanId },
        });
        if (seq !== suggestSeqRef.current) return;
        const nextId = typeof res?.categoryId === "string" ? res.categoryId : "";
        if (!nextId) return;
        // Never override a manual selection.
        if (categoryTouchedRef.current) return;
        if (categoryIdRef.current) return;
        setCategoryId(nextId);
      } catch {
        // ignore
      }
    }, 350);

    return () => {
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
      suggestTimerRef.current = null;
    };
  }, [categoryId, categoryTouched, effectivePlanId, name, visible]);

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
          const hasInitialCategory = Boolean(
            initialCategoryId && data.some((c) => c.id === initialCategoryId)
          );
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
          setCategoryId(hasInitialCategory ? (initialCategoryId as string) : "");
        }
      } catch {
        setPlanCategories(null);
      }
    })();
  }, [visible, effectivePlanId, budgetPlanId, initialCategoryId]);

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

  // Fetch previous expenses (deduped by seriesKey) to prevent duplicates/mismatched history
  useEffect(() => {
    if (!visible) return;
    if (!effectivePlanId || !categoryId) {
      setExpenseSuggestions([]);
      setExpenseSuggestionsLoading(false);
      return;
    }

    const seq = ++expenseSuggestionsSeqRef.current;
    setExpenseSuggestionsLoading(true);
    void (async () => {
      try {
        const url = `/api/bff/expenses/suggestions?budgetPlanId=${encodeURIComponent(
          effectivePlanId
        )}&categoryId=${encodeURIComponent(categoryId)}`;
        const data = await apiFetch<ExpenseSuggestion[]>(url, { cacheTtlMs: 0 });
        if (seq !== expenseSuggestionsSeqRef.current) return;
        setExpenseSuggestions(Array.isArray(data) ? data : []);
      } catch {
        if (seq !== expenseSuggestionsSeqRef.current) return;
        setExpenseSuggestions([]);
      } finally {
        if (seq !== expenseSuggestionsSeqRef.current) return;
        setExpenseSuggestionsLoading(false);
      }
    })();
  }, [visible, effectivePlanId, categoryId]);

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
      if (selectedSeriesKey) body.seriesKey = selectedSeriesKey;

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
      <View style={s.overlay}>
        {/* Backdrop */}
        <Pressable style={s.backdrop} onPress={onClose} />

        {/* Sheet */}
        <Animated.View
          style={[
            s.sheet,
            {
              transform: [{ translateY: Animated.add(slideY, dragY) }],
            },
          ]}
        >
          {/* Handle */}
          <View style={s.handle} {...panHandlers} />

          {/* Header */}
          <View {...panHandlers}>
            <AddExpenseSheetHeader
              month={sheetMonth}
              year={sheetYear}
              title={headerTitle}
              canPrev={canGoBack}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onClose={onClose}
            />
          </View>

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
              setName={handleManualNameChange}
              amount={amount}
              setAmount={handleManualAmountChange}
              categoryId={categoryId}
						setCategoryId={handleManualCategoryChange}
              dueDate={dueDate}
              setDueDate={setDueDate}
              paymentSource={paymentSource}
              setPaymentSource={setPaymentSource}
              cardDebtId={cardDebtId}
              setCardDebtId={setCardDebtId}
              cards={cards}
              categories={planCategories ?? categories}
              currency={currency}
              suggestions={expenseSuggestions}
              suggestionsLoading={expenseSuggestionsLoading}
              onPickSuggestion={(sug) => {
                setName(sug.name);
                setAmount(sug.amount);
                setSelectedSeriesKey(sug.seriesKey);
              }}
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
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: insets.bottom + 24,
              marginBottom: keyboardVisible ? Math.max(0, keyboardHeight - insets.bottom + 8) : 0,
            }}
          >
            <AddExpenseSheetFooter
              error={error}
              canSubmit={canSubmit}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
