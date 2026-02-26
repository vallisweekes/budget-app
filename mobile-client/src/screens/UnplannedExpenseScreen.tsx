/**
 * UnplannedExpenseScreen
 *
 * Dedicated full-screen form for quickly logging an expense that wasn't
 * planned in the budget — e.g. a spontaneous purchase, ad-hoc bill, etc.
 *
 * Posts to POST /api/bff/expenses with paid:true so it immediately shows
 * up as a settled spend in the current month's summary.
 */

import React, { useCallback, useEffect, useState } from "react";
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
import type { Category, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import type { ExpensesStackParamList } from "@/navigation/types";

/* ─── Types ─────────────────────────────────────────────────── */

type Props = NativeStackScreenProps<ExpensesStackParamList, "UnplannedExpense">;

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ─── Screen ─────────────────────────────────────────────────── */

export default function UnplannedExpenseScreen({ navigation }: Props) {
  const topOffset = useTopHeaderOffset();
  const now = new Date();

  /* ── Form state ─────────────────────────────────────────── */
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  /* ── Data ───────────────────────────────────────────────── */
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  /* ── UI state ────────────────────────────────────────────── */
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currency = currencySymbol(settings?.currency);
  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const canSubmit = name.trim().length > 0 && parsedAmount > 0 && !submitting;

  const selectedCategory = categories.find((c) => c.id === categoryId);

  /* ── Load categories + settings ──────────────────────────── */
  const load = useCallback(async () => {
    try {
      const [cats, s] = await Promise.all([
        apiFetch<Category[]>("/api/bff/categories"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setSettings(s);
    } catch {
      // non-fatal
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
      };
      if (categoryId) body.categoryId = categoryId;
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
        {/* ── Mini inline header ── */}
        <View style={[s.header, { paddingTop: topOffset + 12 }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={T.text} />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Log Expense</Text>
            <Text style={s.headerSub}>unplanned</Text>
          </View>
          {/* Spacer to keep title centred */}
          <View style={s.backBtn} />
        </View>

        {loadingData ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : (
          <ScrollView
            style={s.flex}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Amount hero ── */}
            <View style={s.amountCard}>
              <View style={s.amountLabelRow}>
                <Ionicons name="flash" size={15} color={T.accent} />
                <Text style={s.amountLabel}>How much did you spend?</Text>
              </View>
              <View style={s.amountInputRow}>
                <Text style={s.currencySymbol}>{currency}</Text>
                <TextInput
                  style={s.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={`${T.text}33`}
                  returnKeyType="done"
                  autoFocus
                />
              </View>
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
                onPress={() => { setCategoryId(""); setCatPickerOpen(false); }}
              >
                <View style={[s.catDot, { backgroundColor: T.border }]} />
                <Text style={s.catName}>None</Text>
                {!categoryId && <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} />}
              </Pressable>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  style={[s.catRow, categoryId === c.id && s.catRowSelected]}
                  onPress={() => { setCategoryId(c.id); setCatPickerOpen(false); }}
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

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${T.cardAlt}99`,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: T.text, fontSize: 17, fontWeight: "700" },
  headerSub:   { color: T.accent, fontSize: 11, fontWeight: "600", marginTop: 1, textTransform: "uppercase", letterSpacing: 0.8 },

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
