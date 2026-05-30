/**
 * AddExpenseSheet
 *
 * Bottom sheet that slides almost to the top of the screen.
 * Fields: Name · Amount · Category · Paid toggle · Due date (optional)
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ApiError, apiFetch } from "@/lib/api";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { useSwipeDownToClose } from "@/hooks";
import {
  type ExpenseFundingCard,
  getExpenseFundingOptions,
  getExpenseFundingSelectionKey,
  getExpenseFundingSelectionLabel,
  paymentSourceForFunding,
  requiresFundingDebt,
  type ExpenseFundingOption,
  type ExpenseFundingSource,
} from "@/lib/domain/expenseFunding";
import { buildCreateExpenseBody, canSubmitExpense } from "@/lib/domain/expenseMutations";
import { findExpenseCategoryIdByName, findFallbackExpenseCategoryId, getPlanExpenseCategoryBreakdowns } from "@/lib/helpers/expenseCategories";
import { buildPayPeriodFromMonthAnchor, normalizePayFrequency } from "@/lib/payPeriods";
import type {
  Expense,
  ExpenseCategoryBreakdown,
  ExpenseSuggestion,
} from "@/lib/apiTypes";
import { getMobileApiErrorMessage, useCreateExpenseMutation } from "@/store/api";
import { T } from "@/lib/theme";
import { ADD_EXPENSE_SHEET_SCREEN_H, styles } from "./styles";
import type { AddExpenseSheetProps } from "@/types";
import AddExpenseSheetFields from "@/components/Expenses/AddExpenseSheetFields";
import AddExpenseSheetToggles from "@/components/Expenses/AddExpenseSheetToggles";
import AddExpenseSheetFooter from "@/components/Expenses/AddExpenseSheetFooter";
import AddExpenseSheetHeader from "@/components/Expenses/AddExpenseSheetHeader";

const { height: SCREEN_H } = Dimensions.get("window");

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toOptimisticPaymentSource(fundingSource: ExpenseFundingSource): Expense["paymentSource"] {
  if (fundingSource === "loan") return "loan";
  const paymentSource = paymentSourceForFunding(fundingSource);
  return paymentSource === "extra_untracked" ? "other" : paymentSource;
}

function clampLocalDate(date: Date, minimumDate: Date, maximumDate: Date): Date {
  const target = startOfLocalDay(date);
  if (target.getTime() < minimumDate.getTime()) return minimumDate;
  if (target.getTime() > maximumDate.getTime()) return maximumDate;
  return target;
}

// ─── Types ───────────────────────────────────────────────────────────────────

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
}: AddExpenseSheetProps) {
  const insets = useSafeAreaInsets();
  const { settings } = useBootstrapData();
  const slideY = useRef(new Animated.Value(ADD_EXPENSE_SHEET_SCREEN_H ?? SCREEN_H)).current;
  const [createExpense] = useCreateExpenseMutation();

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
  const [fundingSource, setFundingSource] = useState<ExpenseFundingSource>("income");
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [creditCards, setCreditCards] = useState<ExpenseFundingCard[]>([]);

  // Sync selectedPlanId when budgetPlanId prop changes (e.g. parent switches plan)
  useEffect(() => {
    setSelectedPlanId(budgetPlanId ?? null);
    setPlanCategories(null);
  }, [budgetPlanId]);
  const [isDirectDebit, setIsDirectDebit] = useState(false);
  const [distributeMonths, setDistributeMonths] = useState(false);
  const [distributeYears, setDistributeYears] = useState(false);

  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payDate = Number.isFinite(settings?.payDate as number) && (settings?.payDate as number) >= 1
    ? Math.floor(settings?.payDate as number)
    : 27;
  const payFrequency = normalizePayFrequency(settings?.payFrequency);
  const payAnchorDate = payFrequency === "monthly" ? null : (settings?.payAnchorDate ?? null);
  const dueDateWindow = useMemo(() => {
    const period = buildPayPeriodFromMonthAnchor({
      year: sheetYear,
      month: sheetMonth,
      payDate,
      payFrequency,
      payAnchorDate,
    });
    return {
      minimumDate: startOfLocalDay(period.start),
      maximumDate: startOfLocalDay(period.end),
    };
  }, [payAnchorDate, payDate, payFrequency, sheetMonth, sheetYear]);
  const defaultDueDate = useMemo(
    () => clampLocalDate(new Date(), dueDateWindow.minimumDate, dueDateWindow.maximumDate),
    [dueDateWindow.maximumDate, dueDateWindow.minimumDate],
  );

  // Resolve the plan id to use: prefer what the user picked in the sheet
  const effectivePlanId = selectedPlanId ?? budgetPlanId ?? null;
  const resolvedCategories = planCategories ?? categories;
  const effectivePlanKind = useMemo(
    () => plans?.find((plan) => plan.id === effectivePlanId)?.kind ?? null,
    [effectivePlanId, plans],
  );

  const resolveInitialCategoryId = React.useCallback((availableCategories: ExpenseCategoryBreakdown[]) => {
    if (initialCategoryId && availableCategories.some((entry) => entry.categoryId === initialCategoryId)) {
      return initialCategoryId;
    }

    return findFallbackExpenseCategoryId(availableCategories)
      ?? availableCategories[0]?.categoryId
      ?? "";
  }, [initialCategoryId]);

  const { dragY, panHandlers } = useSwipeDownToClose({ onClose, disabled: submitting });

  // Animate in / out
  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      bounciness: 3,
      speed: 18,
    }).start();
    if (visible) {
      setCategoryId(resolveInitialCategoryId(resolvedCategories));
			setCategoryTouched(false);
    }
    if (!visible) {
      // Reset form on close
      setTimeout(() => {
        setName("");
        setAmount("");
			setCategoryId(resolveInitialCategoryId(resolvedCategories));
			setCategoryTouched(false);
        setPaid(false);
        setDueDate("");
        setSheetMonth(month);
        setSheetYear(year);
        setFundingSource("income");
        setSelectedDebtId("");
        setSelectedPlanId(budgetPlanId ?? null);
        setPlanCategories(null);
        setPlanDropdownOpen(false);
        setIsDirectDebit(false);
        setDistributeMonths(false);
        setDistributeYears(false);
        setError(null);
      }, 300);
    }
  }, [budgetPlanId, month, resolveInitialCategoryId, resolvedCategories, slideY, visible, year]);

  const needsDebtSelection = requiresFundingDebt(fundingSource);
  const fundingOptions = useMemo(
    () => getExpenseFundingOptions({ cards: creditCards, settings, selectedSource: fundingSource, selectedDebtId }),
    [creditCards, fundingSource, selectedDebtId, settings],
  );
  const selectedFundingKey = useMemo(
    () => getExpenseFundingSelectionKey(fundingSource, selectedDebtId),
    [fundingSource, selectedDebtId],
  );
  const selectedFundingLabel = useMemo(
    () => getExpenseFundingSelectionLabel(fundingOptions, fundingSource, selectedDebtId),
    [fundingOptions, fundingSource, selectedDebtId],
  );

  const handleFundingOptionSelect = React.useCallback((option: ExpenseFundingOption) => {
    setFundingSource(option.source);
    setSelectedDebtId(option.debtId ?? "");
  }, []);

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
    setDueDate((current) => {
      if (!current) return current;
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(current)
        ? new Date(`${current}T00:00:00`)
        : null;
      if (!parsed || Number.isNaN(parsed.getTime())) return "";
      const normalized = startOfLocalDay(parsed);
      if (normalized.getTime() < dueDateWindow.minimumDate.getTime()) return "";
      if (normalized.getTime() > dueDateWindow.maximumDate.getTime()) return "";
      return current;
    });
  }, [dueDateWindow.maximumDate, dueDateWindow.minimumDate]);

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
        const nextCategoryName = typeof (res as { categoryName?: unknown })?.categoryName === "string"
          ? String((res as { categoryName?: string }).categoryName)
          : "";
        const resolvedSuggestedId = resolvedCategories.some((entry) => entry.categoryId === nextId)
          ? nextId
          : findExpenseCategoryIdByName(resolvedCategories, nextCategoryName)
            ?? nextId;
        if (!resolvedSuggestedId) return;
        // Never override a manual selection.
        if (categoryTouchedRef.current) return;
        if (categoryIdRef.current) return;
        setCategoryId(resolvedSuggestedId);
      } catch {
        // ignore
      }
    }, 350);

    return () => {
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
      suggestTimerRef.current = null;
    };
  }, [categoryId, categoryTouched, effectivePlanId, name, resolvedCategories, visible]);

  useEffect(() => {
    if (!visible) return;
    if (!effectivePlanKind) {
      setPlanCategories(null);
      return;
    }

    const nextCategories = getPlanExpenseCategoryBreakdowns(effectivePlanKind);
    setPlanCategories(nextCategories);
    setCategoryId(resolveInitialCategoryId(nextCategories));
  }, [effectivePlanKind, resolveInitialCategoryId, visible]);

  useEffect(() => {
    if (!visible) return;
    if (categoryTouched) return;
    if (categoryId) return;

    const nextCategoryId = resolveInitialCategoryId(resolvedCategories);
    if (!nextCategoryId) return;

    setCategoryId(nextCategoryId);
  }, [categoryId, categoryTouched, resolveInitialCategoryId, resolvedCategories, visible]);

  // Fetch saved credit cards for the funding picker.
  useEffect(() => {
    if (!visible) return;
    void (async () => {
      try {
        const params = effectivePlanId ? `?budgetPlanId=${encodeURIComponent(effectivePlanId)}` : "";
        const data = await apiFetch<ExpenseFundingCard[]>(`/api/bff/credit-cards${params}`);
        setCreditCards(Array.isArray(data) ? data : []);
      } catch {
        setCreditCards([]);
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
        if (seq === expenseSuggestionsSeqRef.current) {
          setExpenseSuggestionsLoading(false);
        }
      }
    })();
  }, [visible, effectivePlanId, categoryId]);

  const canSubmit = canSubmitExpense(name, amount) && (!needsDebtSelection || selectedDebtId.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    let optimisticId: string | undefined;
    try {
      const body = buildCreateExpenseBody({
        name,
        amount,
        month: sheetMonth,
        year: sheetYear,
        paid,
        isAllocation: false,
        isDirectDebit,
        distributeMonths,
        distributeYears,
        fundingSource,
        categoryId: categoryId || findFallbackExpenseCategoryId(resolvedCategories) || undefined,
        dueDate,
        budgetPlanId: effectivePlanId,
        selectedDebtId,
        seriesKey: selectedSeriesKey,
      });

      optimisticId = `tmp-expense-${Date.now()}`;
      const resolvedCategoryId = typeof body.categoryId === "string" ? body.categoryId : "";
      const optimisticCategory = resolvedCategories.find((entry) => entry.categoryId === resolvedCategoryId);
      const parsedAmount = Number((body.amount as number) ?? 0);
      const optimisticExpense: Expense = {
        id: optimisticId,
        name: String(body.name ?? name.trim()),
        merchantDomain: null,
        logoUrl: null,
        logoSource: null,
        amount: String(parsedAmount),
        paid,
        paidAmount: paid ? String(parsedAmount) : "0",
        isAllocation: false,
        isDirectDebit,
        month: sheetMonth,
        year: sheetYear,
        categoryId: resolvedCategoryId,
        category: optimisticCategory
          ? {
              id: optimisticCategory.categoryId,
              name: optimisticCategory.name,
              icon: optimisticCategory.icon,
              color: optimisticCategory.color,
              budgetAmount: null,
              budgetPlanId: effectivePlanId ?? "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : null,
        dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
        lastPaymentAt: null,
        paymentSource: toOptimisticPaymentSource(fundingSource),
        cardDebtId: needsDebtSelection ? (selectedDebtId || null) : null,
        isExtraLoggedExpense: false,
        effectiveDueDate: typeof body.dueDate === "string" ? body.dueDate : null,
        inSelectedPayPeriod: true,
      };

      // Optimistic UX: close immediately so the sheet never gets stuck on "Adding...".
      // We'll refresh the parent list once the mutation completes.
      onClose();
      onAdded({ phase: "optimistic", expense: optimisticExpense, optimisticId });
      const created = await createExpense(body).unwrap();
      onAdded({ phase: "confirmed", expense: created, optimisticId });
    } catch (e) {
      const errorCode = e instanceof ApiError
        ? e.code
        : (typeof e === "object" && e !== null && "code" in e ? String((e as { code?: unknown }).code ?? "") : "");
      if (errorCode === "REQUEST_TIMEOUT") {
        Alert.alert(
          "Saving is taking longer",
          "The expense will stay visible while the app finishes syncing it.",
        );
        return;
      }

      const message = getMobileApiErrorMessage(e, "Failed to add expense. Try again.");
      onAdded({ phase: "revert", optimisticId });
      setError(message);
      Alert.alert("Couldn't add expense", message);
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
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: Animated.add(slideY, dragY) }],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} {...panHandlers} />

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
            <View style={styles.planPickerWrap}>
              <Pressable
                onPress={() => setPlanDropdownOpen((o) => !o)}
                style={[styles.planPickerButton, planDropdownOpen && styles.planPickerButtonOpen]}
              >
                <Text style={styles.planPickerText} numberOfLines={1}>
                  {plans.find((p) => p.id === effectivePlanId)?.name ?? "Select plan"}
                </Text>
                <Ionicons
                  name={planDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={T.textMuted}
                />
              </Pressable>

              {planDropdownOpen && (
                <View style={styles.planPickerMenu}>
                  {plans.map((p, idx) => {
                    const active = effectivePlanId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => { setSelectedPlanId(p.id); setPlanDropdownOpen(false); }}
                        style={[
                          styles.planPickerOption,
                          idx === 0 && styles.planPickerOptionFirst,
                          active && styles.planPickerOptionActive,
                        ]}
                      >
                        <Text style={[styles.planPickerOptionText, active && styles.planPickerOptionTextActive]} numberOfLines={1}>
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
            contentContainerStyle={styles.scrollContent}
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
              fundingOptions={fundingOptions}
              selectedFundingKey={selectedFundingKey}
              selectedFundingLabel={selectedFundingLabel}
              onSelectFundingOption={handleFundingOptionSelect}
              categories={planCategories ?? categories}
              currency={currency}
              minimumDate={dueDateWindow.minimumDate}
              maximumDate={dueDateWindow.maximumDate}
              fallbackDate={defaultDueDate}
              suggestions={expenseSuggestions}
              suggestionsLoading={expenseSuggestionsLoading}
              onPickSuggestion={(sug) => {
                setName(sug.name);
                setAmount(sug.amount);
                setSelectedSeriesKey(sug.seriesKey);
              }}
            />

            <View style={styles.togglesWrap}>
              <AddExpenseSheetToggles
                paid={paid}
                setPaid={setPaid}
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
              ...styles.footerWrap,
              paddingBottom: insets.bottom + 2,
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
