/**
 * UnplannedExpenseScreen
 *
 * Dedicated full-screen form for quickly logging an expense that wasn't
 * planned in the budget — e.g. a spontaneous purchase, ad-hoc bill, etc.
 *
 * Posts to POST /api/bff/expenses with paid:true so it immediately shows
 * up as a settled spend in the current month's summary.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { apiFetch } from "@/lib/api";
import type { Category, Debt, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";
import type { ExpensesStackParamList } from "@/navigation/types";

/* ─── Types ─────────────────────────────────────────────────── */

type Props = NativeStackScreenProps<ExpensesStackParamList, "UnplannedExpense">;

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const NEW_LOAN_SENTINEL = "__new_loan__";

type FundingSource = "income" | "savings" | "monthly_allowance" | "credit_card" | "loan" | "other";

const FUNDING_OPTIONS: Array<{ value: FundingSource; label: string }> = [
  { value: "income", label: "Income" },
  { value: "savings", label: "Savings" },
  { value: "monthly_allowance", label: "Monthly allowance" },
  { value: "credit_card", label: "Credit card" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
];

function paymentSourceForFunding(funding: FundingSource): "income" | "savings" | "credit_card" | "extra_untracked" {
  if (funding === "savings") return "savings";
  if (funding === "credit_card") return "credit_card";
  if (funding === "monthly_allowance" || funding === "loan" || funding === "other") return "extra_untracked";
  return "income";
}

/* ─── Screen ─────────────────────────────────────────────────── */

export default function UnplannedExpenseScreen({ navigation }: Props) {
  const topOffset = useTopHeaderOffset();
  const now = new Date();

  /* ── Form state ─────────────────────────────────────────── */
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const categoryTouchedRef = useRef(false);
  const categoryIdRef = useRef("");
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestSeqRef = useRef(0);
  const [fundingSource, setFundingSource] = useState<FundingSource>("income");
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [newLoanName, setNewLoanName] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  /* ── Data ───────────────────────────────────────────────── */
  const [categories, setCategories] = useState<Category[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  /* ── UI state ────────────────────────────────────────────── */
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [fundingPickerOpen, setFundingPickerOpen] = useState(false);
  const [debtPickerOpen, setDebtPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currency = currencySymbol(settings?.currency);
  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const cardDebts = debts.filter((d) => d.type === "credit_card" || d.type === "store_card");
  const loanDebts = debts.filter((d) => d.type === "loan" || d.type === "mortgage" || d.type === "hire_purchase" || d.type === "other");
  const needsDebtChoice = fundingSource === "credit_card" || fundingSource === "loan";
  const usingNewLoan = fundingSource === "loan" && selectedDebtId === NEW_LOAN_SENTINEL;
  const debtChoiceValid = !needsDebtChoice || (selectedDebtId.length > 0 && (!usingNewLoan || newLoanName.trim().length > 0));
  const canSubmit = name.trim().length > 0 && parsedAmount > 0 && debtChoiceValid && !submitting;

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const fundingLabel = FUNDING_OPTIONS.find((f) => f.value === fundingSource)?.label ?? "Income";
  const debtChoices = fundingSource === "credit_card" ? cardDebts : loanDebts;
  const selectedDebt = debtChoices.find((d) => d.id === selectedDebtId);

  /* ── Load categories + settings ──────────────────────────── */
  const load = useCallback(async () => {
    try {
      const [cats, debtList, s] = await Promise.all([
        apiFetch<Category[]>("/api/bff/categories"),
        apiFetch<Debt[]>("/api/bff/debts"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setDebts(Array.isArray(debtList) ? debtList : []);
      setSettings(s);
    } catch {
      // non-fatal
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    categoryTouchedRef.current = categoryTouched;
  }, [categoryTouched]);
  useEffect(() => {
    categoryIdRef.current = categoryId;
  }, [categoryId]);

  useEffect(() => {
    if (categoryTouchedRef.current) return;
    if (categoryIdRef.current) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) return;

    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(async () => {
      const seq = ++suggestSeqRef.current;
      try {
        const res = await apiFetch<{ categoryId: string | null }>("/api/bff/expenses/suggest-category", {
          method: "POST",
          body: { expenseName: trimmed },
        });
        if (seq !== suggestSeqRef.current) return;
        const nextId = typeof res?.categoryId === "string" ? res.categoryId : "";
        if (!nextId) return;
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
  }, [name]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (fundingSource === "credit_card") {
      if (cardDebts.length === 1) setSelectedDebtId(cardDebts[0]!.id);
      else if (!cardDebts.some((d) => d.id === selectedDebtId)) setSelectedDebtId("");
      setNewLoanName("");
      return;
    }
    if (fundingSource === "loan") {
      if (selectedDebtId === NEW_LOAN_SENTINEL) return;
      if (!loanDebts.some((d) => d.id === selectedDebtId)) setSelectedDebtId("");
      return;
    }
    setSelectedDebtId("");
    setNewLoanName("");
  }, [fundingSource, cardDebts, loanDebts, selectedDebtId]);

  /* ── Submit ──────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        amount: parsedAmount,
        month,
        year,
        paid: true,
        isAllocation: false,
        isDirectDebit: false,
        fundingSource,
        paymentSource: paymentSourceForFunding(fundingSource),
      };
      if (categoryId) body.categoryId = categoryId;
      if (fundingSource === "credit_card" && selectedDebtId) {
        body.cardDebtId = selectedDebtId;
        body.debtId = selectedDebtId;
      }
      if (fundingSource === "loan") {
        if (selectedDebtId && selectedDebtId !== NEW_LOAN_SENTINEL) {
          body.debtId = selectedDebtId;
        }
        if (selectedDebtId === NEW_LOAN_SENTINEL && newLoanName.trim()) {
          body.newLoanName = newLoanName.trim();
        }
      }
      await apiFetch("/api/bff/expenses", { method: "POST", body });
      navigation.goBack();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to log expense. Try again.");
      setSubmitting(false);
    }
  };

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {loadingData ? (
          <View style={[s.center, { paddingTop: topOffset + 12 }]}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : (
          <ScrollView
            style={s.flex}
            contentContainerStyle={[s.scrollContent, { paddingTop: topOffset + 12 }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Amount hero ── */}
            <View style={s.amountCard}>
              <View style={s.amountLabelRow}>
                <Ionicons name="flash" size={15} color={T.accent} />
                <Text style={s.amountLabel}>How much did you spend?</Text>
              </View>
              <MoneyInput
                currency={currency}
                value={amount}
                onChangeValue={setAmount}
                placeholder="0.00"
                returnKeyType="done"
              />
            </View>

            {/* ── Description ── */}
            <View style={s.fieldCard}>
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={s.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Lunch, taxi, groceries…"
                placeholderTextColor={T.textMuted}
                returnKeyType="done"
                maxLength={80}
              />
            </View>

            {/* ── Category ── */}
            <Pressable style={s.fieldCard} onPress={() => setCatPickerOpen(true)}>
              <Text style={s.fieldLabel}>Category</Text>
              <View style={s.fieldRow}>
                {selectedCategory ? (
                  <>
                    <View style={[s.catDot, { backgroundColor: selectedCategory.color ?? T.accentDim }]} />
                    <Text style={s.fieldValue}>{selectedCategory.name}</Text>
                  </>
                ) : (
                  <Text style={s.fieldPlaceholder}>Select a category</Text>
                )}
                <Ionicons name="chevron-forward" size={16} color={T.textDim} style={s.fieldChevron} />
              </View>
            </Pressable>

            {/* ── Month ── */}
            <Pressable style={s.fieldCard} onPress={() => setFundingPickerOpen(true)}>
              <Text style={s.fieldLabel}>Funds From</Text>
              <View style={s.fieldRow}>
                <Text style={s.fieldValue}>{fundingLabel}</Text>
                <Ionicons name="chevron-forward" size={16} color={T.textDim} style={s.fieldChevron} />
              </View>
            </Pressable>

            {needsDebtChoice ? (
              <Pressable style={s.fieldCard} onPress={() => setDebtPickerOpen(true)}>
                <Text style={s.fieldLabel}>{fundingSource === "credit_card" ? "Credit Card" : "Loan"}</Text>
                <View style={s.fieldRow}>
                  {selectedDebt ? (
                    <Text style={s.fieldValue}>{selectedDebt.name}</Text>
                  ) : usingNewLoan ? (
                    <Text style={s.fieldValue}>Create new loan</Text>
                  ) : (
                    <Text style={s.fieldPlaceholder}>
                      {fundingSource === "credit_card" ? "Select a card" : "Select existing or create new loan"}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={T.textDim} style={s.fieldChevron} />
                </View>
              </Pressable>
            ) : null}

            {usingNewLoan ? (
              <View style={s.fieldCard}>
                <Text style={s.fieldLabel}>New Loan Name</Text>
                <TextInput
                  style={s.fieldInput}
                  value={newLoanName}
                  onChangeText={setNewLoanName}
                  placeholder="e.g. Family loan"
                  placeholderTextColor={T.textMuted}
                  returnKeyType="done"
                  maxLength={80}
                />
              </View>
            ) : null}

            <Pressable
              style={s.fieldCard}
              onPress={() => { setPickerYear(year); setMonthPickerOpen(true); }}
            >
              <Text style={s.fieldLabel}>Month</Text>
              <View style={s.fieldRow}>
                <Text style={s.fieldValue}>{MONTH_NAMES[month - 1]} {year}</Text>
                <Ionicons name="chevron-forward" size={16} color={T.textDim} style={s.fieldChevron} />
              </View>
            </Pressable>

            {/* ── Error ── */}
            {submitError ? (
              <View style={s.errorWrap}>
                <Ionicons name="warning-outline" size={15} color={T.red} />
                <Text style={s.errorText}>{submitError}</Text>
              </View>
            ) : null}

            {/* ── Submit ── */}
            <Pressable
              style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={T.onAccent} />
              ) : (
                <>
                  <Ionicons name="flash" size={17} color={T.onAccent} />
                  <Text style={s.submitTxt}>
                    {parsedAmount > 0
                      ? `Log ${fmt(parsedAmount, currency)}`
                      : "Log Expense"}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* ── Category picker modal ── */}
      <Modal
        visible={catPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCatPickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={() => setCatPickerOpen(false)} />
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Category</Text>
            <ScrollView contentContainerStyle={s.catList}>
              {/* No-category option */}
              <Pressable
                style={[s.catRow, !categoryId && s.catRowSelected]}
					onPress={() => { setCategoryTouched(true); setCategoryId(""); setCatPickerOpen(false); }}
              >
                <View style={[s.catDot, { backgroundColor: T.border }]} />
                <Text style={s.catName}>None</Text>
                {!categoryId && <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} />}
              </Pressable>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  style={[s.catRow, categoryId === c.id && s.catRowSelected]}
						onPress={() => { setCategoryTouched(true); setCategoryId(c.id); setCatPickerOpen(false); }}
                >
                  <View style={[s.catDot, { backgroundColor: c.color ?? T.accentDim }]} />
                  <Text style={s.catName}>{c.name}</Text>
                  {categoryId === c.id && (
                    <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Funding source picker modal ── */}
      <Modal
        visible={fundingPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFundingPickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={() => setFundingPickerOpen(false)} />
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Funds From</Text>
            <ScrollView contentContainerStyle={s.catList}>
              {FUNDING_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[s.catRow, fundingSource === opt.value && s.catRowSelected]}
                  onPress={() => {
                    setFundingSource(opt.value);
                    setFundingPickerOpen(false);
                  }}
                >
                  <Text style={s.catName}>{opt.label}</Text>
                  {fundingSource === opt.value ? <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Credit card / loan picker modal ── */}
      <Modal
        visible={debtPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDebtPickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={() => setDebtPickerOpen(false)} />
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{fundingSource === "credit_card" ? "Choose Card" : "Choose Loan"}</Text>
            <ScrollView contentContainerStyle={s.catList}>
              {fundingSource === "loan" ? (
                <Pressable
                  style={[s.catRow, selectedDebtId === NEW_LOAN_SENTINEL && s.catRowSelected]}
                  onPress={() => {
                    setSelectedDebtId(NEW_LOAN_SENTINEL);
                    setDebtPickerOpen(false);
                  }}
                >
                  <Text style={s.catName}>+ Create new loan</Text>
                  {selectedDebtId === NEW_LOAN_SENTINEL ? <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} /> : null}
                </Pressable>
              ) : null}
              {debtChoices.map((d) => (
                <Pressable
                  key={d.id}
                  style={[s.catRow, selectedDebtId === d.id && s.catRowSelected]}
                  onPress={() => {
                    setSelectedDebtId(d.id);
                    setDebtPickerOpen(false);
                  }}
                >
                  <Text style={s.catName}>{d.name}</Text>
                  {selectedDebtId === d.id ? <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} /> : null}
                </Pressable>
              ))}
              {debtChoices.length === 0 ? (
                <Text style={[s.fieldPlaceholder, { paddingVertical: 8 }]}>No options found.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Month picker modal ── */}
      <Modal
        visible={monthPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={() => setMonthPickerOpen(false)} />
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <View style={s.pickerYearRow}>
              <Pressable onPress={() => setPickerYear((y) => y - 1)} hitSlop={12} style={s.pickerYearBtn}>
                <Ionicons name="chevron-back" size={22} color={T.text} />
              </Pressable>
              <Text style={s.pickerYearText}>{pickerYear}</Text>
              <Pressable onPress={() => setPickerYear((y) => y + 1)} hitSlop={12} style={s.pickerYearBtn}>
                <Ionicons name="chevron-forward" size={22} color={T.text} />
              </Pressable>
            </View>
            <View style={s.pickerGrid}>
              {SHORT_MONTHS.map((name, idx) => {
                const m = idx + 1;
                const isSelected = m === month && pickerYear === year;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setMonth(m);
                      setYear(pickerYear);
                      setMonthPickerOpen(false);
                    }}
                    style={[s.pickerCell, isSelected && s.pickerCellSelected]}
                  >
                    <Text style={[s.pickerCellText, isSelected && s.pickerCellSelectedText]}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: T.bg },
  flex:        { flex: 1 },
  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },

  /* Amount card */
  amountCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: T.accentBorder,
    marginTop: 4,
  },
  amountLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  amountLabel:    { color: T.textDim, fontSize: 13, fontWeight: "500" },
  amountInputRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  currencySymbol: { color: T.text, fontSize: 28, fontWeight: "700" },
  amountInput: {
    flex: 1,
    color: T.text,
    fontSize: 42,
    fontWeight: "800",
    padding: 0,
    letterSpacing: -1,
  },

  /* Field cards */
  fieldCard: {
    backgroundColor: T.card,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  fieldLabel:      { color: T.textDim, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  fieldInput:      { color: T.text, fontSize: 16, padding: 0 },
  fieldRow:        { flexDirection: "row", alignItems: "center" },
  fieldValue:      { flex: 1, color: T.text, fontSize: 15, fontWeight: "500" },
  fieldPlaceholder: { flex: 1, color: T.textMuted, fontSize: 15 },
  fieldChevron:    { marginLeft: 6 },

  /* Category */
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },

  /* Error */
  errorWrap: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
  errorText: { color: T.red, fontSize: 13, flex: 1 },

  /* Submit */
  submitBtn: {
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitTxt: { color: T.onAccent, fontSize: 16, fontWeight: "700" },

  /* Modal shared */
  modalOverlay:  { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 40,
    maxHeight: "75%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: T.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: { color: T.text, fontSize: 16, fontWeight: "700", marginBottom: 12 },

  /* Category list */
  catList:    { paddingBottom: 8 },
  catRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.border },
  catRowSelected: { backgroundColor: `${T.accent}0d`, marginHorizontal: -18, paddingHorizontal: 18 },
  catName:    { flex: 1, color: T.text, fontSize: 15 },
  catCheck:   { marginLeft: 8 },

  /* Month picker */
  pickerYearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 16,
  },
  pickerYearBtn:  { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  pickerYearText: { color: T.text, fontSize: 22, fontWeight: "700", minWidth: 60, textAlign: "center" },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  pickerCell: {
    width: "23%",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    alignItems: "center",
  },
  pickerCellSelected:     { backgroundColor: T.accent, borderColor: T.accent },
  pickerCellText:         { color: T.textDim, fontSize: 14, fontWeight: "500" },
  pickerCellSelectedText: { color: T.onAccent, fontWeight: "700" },
});
