/**
 * ScanReceiptScreen
 *
 * Flow:
 *  1. User picks camera or gallery
 *  2. Image compressed + sent to POST /api/bff/receipts/scan (OpenAI Vision)
 *  3. Editable confirmation form shown with AI-prefilled fields
 *  4. On confirm → POST /api/bff/receipts/[id]/confirm creates the Expense
 *  5. Navigate back with success
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
  Animated,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { apiFetch } from "@/lib/api";
import type {
  Category,
  Debt,
  Settings,
  ReceiptScanResponse,
  ReceiptConfirmBody,
} from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import type { ExpensesStackParamList } from "@/navigation/types";

/* ─── Types ─────────────────────────────────────────────────── */

type Props = NativeStackScreenProps<ExpensesStackParamList, "ScanReceipt">;

type Stage =
  | "pick"        // Initial pick method screen
  | "scanning"    // Uploading + AI processing
  | "confirm"     // Editable confirmation form
  | "saving";     // Saving to backend

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

/* ─── Helpers ───────────────────────────────────────────────── */

function parseDateFields(isoDate: string | null): { month: number; year: number } {
  const now = new Date();
  if (!isoDate) return { month: now.getMonth() + 1, year: now.getFullYear() };
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return { month: now.getMonth() + 1, year: now.getFullYear() };
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

/* ─── Screen ─────────────────────────────────────────────────── */

export default function ScanReceiptScreen({ navigation }: Props) {
  const topOffset = useTopHeaderOffset();
  const now = new Date();

  /* ── Stage ──────────────────────────────────────────────── */
  const [stage,    setStage]    = useState<Stage>("pick");
  const [scanError, setScanError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* ── Receipt from scan ──────────────────────────────────── */
  const [receiptId,         setReceiptId]        = useState<string | null>(null);
  const [previewUri,        setPreviewUri]        = useState<string | null>(null);

  /* ── Confirmation form ──────────────────────────────────── */
  const [name,         setName]        = useState("");
  const [amount,       setAmount]      = useState("");
  const [categoryId,   setCategoryId]  = useState("");
  const [fundingSource, setFundingSource] = useState<FundingSource>("income");
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [newLoanName, setNewLoanName] = useState("");
  const [month,        setMonth]       = useState(now.getMonth() + 1);
  const [year,         setYear]        = useState(now.getFullYear());

  /* ── Data ───────────────────────────────────────────────── */
  const [categories, setCategories] = useState<Category[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [settings,   setSettings]   = useState<Settings | null>(null);

  /* ── UI pickers ─────────────────────────────────────────── */
  const [catPickerOpen,   setCatPickerOpen]   = useState(false);
  const [fundingPickerOpen, setFundingPickerOpen] = useState(false);
  const [debtPickerOpen, setDebtPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear,      setPickerYear]      = useState(year);

  const closeCatPicker = useCallback(() => setCatPickerOpen(false), []);
  const closeFundingPicker = useCallback(() => setFundingPickerOpen(false), []);
  const closeDebtPicker = useCallback(() => setDebtPickerOpen(false), []);
  const closeMonthPicker = useCallback(() => setMonthPickerOpen(false), []);

  const { dragY: catPickerDragY, panHandlers: catPickerPanHandlers, resetDrag: resetCatPickerDrag } = useSwipeDownToClose({
    onClose: closeCatPicker,
    disabled: stage === "saving",
  });
  const { dragY: fundingPickerDragY, panHandlers: fundingPickerPanHandlers, resetDrag: resetFundingPickerDrag } = useSwipeDownToClose({
    onClose: closeFundingPicker,
    disabled: stage === "saving",
  });
  const { dragY: debtPickerDragY, panHandlers: debtPickerPanHandlers, resetDrag: resetDebtPickerDrag } = useSwipeDownToClose({
    onClose: closeDebtPicker,
    disabled: stage === "saving",
  });
  const { dragY: monthPickerDragY, panHandlers: monthPickerPanHandlers, resetDrag: resetMonthPickerDrag } = useSwipeDownToClose({
    onClose: closeMonthPicker,
    disabled: stage === "saving",
  });

  useEffect(() => { if (catPickerOpen) resetCatPickerDrag(); }, [catPickerOpen, resetCatPickerDrag]);
  useEffect(() => { if (fundingPickerOpen) resetFundingPickerDrag(); }, [fundingPickerOpen, resetFundingPickerDrag]);
  useEffect(() => { if (debtPickerOpen) resetDebtPickerDrag(); }, [debtPickerOpen, resetDebtPickerDrag]);
  useEffect(() => { if (monthPickerOpen) resetMonthPickerDrag(); }, [monthPickerOpen, resetMonthPickerDrag]);

  /* ── Scanning shimmer ────────────────────────────────────── */
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== "scanning") return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [stage, shimmer]);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  const currency = currencySymbol(settings?.currency);
  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const cardDebts = debts.filter((d) => d.type === "credit_card" || d.type === "store_card");
  const loanDebts = debts.filter((d) => d.type === "loan" || d.type === "mortgage" || d.type === "hire_purchase" || d.type === "other");
  const needsDebtChoice = fundingSource === "credit_card" || fundingSource === "loan";
  const usingNewLoan = fundingSource === "loan" && selectedDebtId === NEW_LOAN_SENTINEL;
  const debtChoiceValid = !needsDebtChoice || (selectedDebtId.length > 0 && (!usingNewLoan || newLoanName.trim().length > 0));
  const canSave = name.trim().length > 0 && parsedAmount > 0 && !!receiptId && debtChoiceValid;
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const fundingLabel = FUNDING_OPTIONS.find((f) => f.value === fundingSource)?.label ?? "Income";
  const debtChoices = fundingSource === "credit_card" ? cardDebts : loanDebts;
  const selectedDebt = debtChoices.find((d) => d.id === selectedDebtId);

  /* ── Load support data ───────────────────────────────────── */
  const loadSupportData = useCallback(async () => {
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
      // non-blocking
    }
  }, []);

  useEffect(() => { void loadSupportData(); }, [loadSupportData]);

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

  /* ── Auto-match AI suggested category ───────────────────── */
  const applySuggestedCategory = useCallback(
    (suggestion: string | null, cats: Category[]) => {
      if (!suggestion || cats.length === 0) return;
      const lower = suggestion.toLowerCase();
      const match = cats.find(
        (c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
      );
      if (match) setCategoryId(match.id);
    },
    []
  );

  /* ── Send image to API ───────────────────────────────────── */
  const handleImage = useCallback(
    async (base64: string, uri: string) => {
      setPreviewUri(uri);
      setStage("scanning");
      setScanError(null);
      try {
        const result = await apiFetch<ReceiptScanResponse>("/api/bff/receipts/scan", {
          method: "POST",
          body: { image: base64 },
        });
        setReceiptId(result.receiptId);
        setName(result.merchant ?? "");
        setAmount(result.amount != null ? String(result.amount) : "");
        const { month: m, year: y } = parseDateFields(result.date);
        setMonth(m);
        setYear(y);
        applySuggestedCategory(result.suggestedCategory, categories);
        setStage("confirm");
      } catch (e) {
        setScanError(e instanceof Error ? e.message : "Scan failed. Please try again.");
        setStage("pick");
      }
    },
    [applySuggestedCategory, categories]
  );

  /* ── Camera ─────────────────────────────────────────────── */
  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setScanError("Camera permission is required to scan receipts.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.55,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]?.base64 && result.assets[0].uri) {
      await handleImage(result.assets[0].base64, result.assets[0].uri);
    }
  };

  /* ── Gallery ─────────────────────────────────────────────── */
  const launchGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setScanError("Photo library permission is required to import receipts.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.55,
      base64: true,
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets[0]?.base64 && result.assets[0].uri) {
      await handleImage(result.assets[0].base64, result.assets[0].uri);
    }
  };

  /* ── Confirm + save ──────────────────────────────────────── */
  const handleConfirm = async () => {
    if (!canSave || !receiptId) return;
    setSaveError(null);
    setStage("saving");
    try {
      const confirmBody: ReceiptConfirmBody = {
        name: name.trim(),
        amount: parsedAmount,
        month,
        year,
        categoryId: categoryId || undefined,
        fundingSource,
        paymentSource: paymentSourceForFunding(fundingSource),
      };
      if (fundingSource === "credit_card" && selectedDebtId) {
        confirmBody.cardDebtId = selectedDebtId;
        confirmBody.debtId = selectedDebtId;
      }
      if (fundingSource === "loan") {
        if (selectedDebtId && selectedDebtId !== NEW_LOAN_SENTINEL) {
          confirmBody.debtId = selectedDebtId;
        }
        if (selectedDebtId === NEW_LOAN_SENTINEL && newLoanName.trim()) {
          confirmBody.newLoanName = newLoanName.trim();
        }
      }
      await apiFetch(`/api/bff/receipts/${receiptId}/confirm`, {
        method: "POST",
        body: confirmBody,
      });
      navigation.goBack();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save expense. Try again.");
      setStage("confirm");
    }
  };

  /* ── Render: Scanning ────────────────────────────────────── */
  if (stage === "scanning") {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={[s.scanningWrap, { paddingTop: topOffset + 20 }]}> 
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={s.previewImg} resizeMode="cover" />
          ) : null}
          <View style={s.scanningOverlay}>
            <Animated.View style={[s.scanningIcon, { opacity: shimmerOpacity }]}>
              <Ionicons name="scan-outline" size={52} color={T.accent} />
            </Animated.View>
            <Text style={s.scanningTitle}>Reading your receipt…</Text>
            <Text style={s.scanningSubtitle}>AI is extracting the details</Text>
            <ActivityIndicator size="small" color={T.accent} style={{ marginTop: 16 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Render: Confirmation form ───────────────────────────── */
  if (stage === "confirm" || stage === "saving") {
    const saving = stage === "saving";
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={s.flex} contentContainerStyle={[s.scrollContent, { paddingTop: topOffset + 12 }]} keyboardShouldPersistTaps="handled">
            {/* Receipt thumbnail */}
            {previewUri ? (
              <View style={s.thumbWrap}>
                <Image source={{ uri: previewUri }} style={s.thumb} resizeMode="contain" />
                <View style={s.thumbBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={T.green} />
                  <Text style={s.thumbBadgeTxt}>Receipt scanned</Text>
                </View>
              </View>
            ) : null}

            {/* Amount */}
            <View style={s.amountCard}>
              <View style={s.amountLabelRow}>
                <Ionicons name="receipt-outline" size={14} color={T.accent} />
                <Text style={s.amountLabel}>Total amount</Text>
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
                  editable={!saving}
                />
              </View>
            </View>

            {/* Name / merchant */}
            <View style={s.fieldCard}>
              <Text style={s.fieldLabel}>Merchant / Description</Text>
              <TextInput
                style={s.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Tesco, Costa Coffee…"
                placeholderTextColor={T.textMuted}
                returnKeyType="done"
                maxLength={80}
                editable={!saving}
              />
            </View>

            {/* Category */}
            <Pressable style={s.fieldCard} onPress={() => !saving && setCatPickerOpen(true)}>
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

            {/* Funds from */}
            <Pressable style={s.fieldCard} onPress={() => !saving && setFundingPickerOpen(true)}>
              <Text style={s.fieldLabel}>Funds From</Text>
              <View style={s.fieldRow}>
                <Text style={s.fieldValue}>{fundingLabel}</Text>
                <Ionicons name="chevron-forward" size={16} color={T.textDim} style={s.fieldChevron} />
              </View>
            </Pressable>

            {needsDebtChoice ? (
              <Pressable style={s.fieldCard} onPress={() => !saving && setDebtPickerOpen(true)}>
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
                  editable={!saving}
                />
              </View>
            ) : null}

            {/* Month */}
            <Pressable
              style={s.fieldCard}
              onPress={() => { if (!saving) { setPickerYear(year); setMonthPickerOpen(true); } }}
            >
              <Text style={s.fieldLabel}>Month</Text>
              <View style={s.fieldRow}>
                <Text style={s.fieldValue}>{MONTH_NAMES[month - 1]} {year}</Text>
                <Ionicons name="chevron-forward" size={16} color={T.textDim} style={s.fieldChevron} />
              </View>
            </Pressable>

            {saveError ? (
              <View style={s.errorWrap}>
                <Ionicons name="warning-outline" size={15} color={T.red} />
                <Text style={s.errorText}>{saveError}</Text>
              </View>
            ) : null}

            {/* Confirm CTA */}
            <Pressable
              style={[s.submitBtn, (!canSave || saving) && s.submitBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canSave || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={T.onAccent} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={T.onAccent} />
                  <Text style={s.submitTxt}>
                    {parsedAmount > 0 ? `Save ${fmt(parsedAmount, currency)}` : "Save Expense"}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Category picker */}
        <Modal visible={catPickerOpen} transparent animationType="slide" onRequestClose={closeCatPicker}>
          <View style={s.modalOverlay}>
            <Pressable style={s.modalBackdrop} onPress={closeCatPicker} />
            <Animated.View style={[s.modalSheet, { transform: [{ translateY: catPickerDragY }] }]}>
              <View style={s.sheetHandle} {...catPickerPanHandlers} />
              <Text style={s.sheetTitle}>Category</Text>
              <ScrollView contentContainerStyle={s.catList}>
                <Pressable
                  style={[s.catRow, !categoryId && s.catRowSelected]}
                  onPress={() => { setCategoryId(""); closeCatPicker(); }}
                >
                  <View style={[s.catDot, { backgroundColor: T.border }]} />
                  <Text style={s.catName}>None</Text>
                  {!categoryId && <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} />}
                </Pressable>
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[s.catRow, categoryId === c.id && s.catRowSelected]}
                    onPress={() => { setCategoryId(c.id); closeCatPicker(); }}
                  >
                    <View style={[s.catDot, { backgroundColor: c.color ?? T.accentDim }]} />
                    <Text style={s.catName}>{c.name}</Text>
                    {categoryId === c.id && <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} />}
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>

        <Modal visible={fundingPickerOpen} transparent animationType="slide" onRequestClose={closeFundingPicker}>
          <View style={s.modalOverlay}>
            <Pressable style={s.modalBackdrop} onPress={closeFundingPicker} />
            <Animated.View style={[s.modalSheet, { transform: [{ translateY: fundingPickerDragY }] }]}>
              <View style={s.sheetHandle} {...fundingPickerPanHandlers} />
              <Text style={s.sheetTitle}>Funds From</Text>
              <ScrollView contentContainerStyle={s.catList}>
                {FUNDING_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[s.catRow, fundingSource === opt.value && s.catRowSelected]}
                    onPress={() => {
                      setFundingSource(opt.value);
                      closeFundingPicker();
                    }}
                  >
                    <Text style={s.catName}>{opt.label}</Text>
                    {fundingSource === opt.value ? <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>

        <Modal visible={debtPickerOpen} transparent animationType="slide" onRequestClose={closeDebtPicker}>
          <View style={s.modalOverlay}>
            <Pressable style={s.modalBackdrop} onPress={closeDebtPicker} />
            <Animated.View style={[s.modalSheet, { transform: [{ translateY: debtPickerDragY }] }]}>
              <View style={s.sheetHandle} {...debtPickerPanHandlers} />
              <Text style={s.sheetTitle}>{fundingSource === "credit_card" ? "Choose Card" : "Choose Loan"}</Text>
              <ScrollView contentContainerStyle={s.catList}>
                {fundingSource === "loan" ? (
                  <Pressable
                    style={[s.catRow, selectedDebtId === NEW_LOAN_SENTINEL && s.catRowSelected]}
                    onPress={() => {
                      setSelectedDebtId(NEW_LOAN_SENTINEL);
                      closeDebtPicker();
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
                      closeDebtPicker();
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
            </Animated.View>
          </View>
        </Modal>

        {/* Month picker */}
        <Modal visible={monthPickerOpen} transparent animationType="slide" onRequestClose={closeMonthPicker}>
          <View style={s.modalOverlay}>
            <Pressable style={s.modalBackdrop} onPress={closeMonthPicker} />
            <Animated.View style={[s.modalSheet, { transform: [{ translateY: monthPickerDragY }] }]}>
              <View style={s.sheetHandle} {...monthPickerPanHandlers} />
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
                {SHORT_MONTHS.map((mName, idx) => {
                  const m = idx + 1;
                  const isSelected = m === month && pickerYear === year;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => { setMonth(m); setYear(pickerYear); closeMonthPicker(); }}
                      style={[s.pickerCell, isSelected && s.pickerCellSelected]}
                    >
                      <Text style={[s.pickerCellText, isSelected && s.pickerCellSelectedText]}>{mName}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  /* ── Render: Pick method (initial / retry) ───────────────── */
  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={[s.pickWrap, { paddingTop: topOffset + 12 }]}> 
        {/* Hero illustration */}
        <View style={s.heroIconWrap}>
          <Ionicons name="receipt-outline" size={64} color={T.accent} />
        </View>
        <Text style={s.heroTitle}>Snap your receipt</Text>
        <Text style={s.heroSub}>
          AI reads the receipt and fills in the amount, merchant, and date — you just confirm.
        </Text>

        {scanError ? (
          <View style={s.errorWrap}>
            <Ionicons name="warning-outline" size={15} color={T.red} />
            <Text style={s.errorText}>{scanError}</Text>
          </View>
        ) : null}

        <Pressable style={s.pickOptionCamera} onPress={launchCamera}>
          <View style={s.pickOptionIcon}>
            <Ionicons name="camera" size={24} color={T.onAccent} />
          </View>
          <View style={s.pickOptionText}>
            <Text style={s.pickOptionTitle}>Take a photo</Text>
            <Text style={s.pickOptionSub}>Use your camera to scan a receipt</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.textDim} />
        </Pressable>

        <Pressable style={s.pickOptionGallery} onPress={launchGallery}>
          <View style={[s.pickOptionIcon, s.pickOptionIconSecondary]}>
            <Ionicons name="images" size={24} color={T.accent} />
          </View>
          <View style={s.pickOptionText}>
            <Text style={[s.pickOptionTitle, { color: T.text }]}>Choose from library</Text>
            <Text style={[s.pickOptionSub, { color: T.textDim }]}>Import an existing receipt photo</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.textDim} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: T.bg },
  flex:         { flex: 1 },
  scrollContent:{ paddingHorizontal: 18, paddingBottom: 40, gap: 12 },

  /* Pick stage */
  pickWrap: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 14,
    paddingTop: 8,
  },
  heroIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${T.accent}18`,
    borderWidth: 1,
    borderColor: T.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  heroTitle: { color: T.text, fontSize: 22, fontWeight: "800", textAlign: "center" },
  heroSub:   { color: T.textDim, fontSize: 14, textAlign: "center", lineHeight: 20 },

  pickOptionCamera: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.accent,
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  pickOptionGallery: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.card,
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  pickOptionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: `${T.onAccent}22`,
    alignItems: "center",
    justifyContent: "center",
  },
  pickOptionIconSecondary: {
    backgroundColor: `${T.accent}15`,
  },
  pickOptionText:  { flex: 1 },
  pickOptionTitle: { color: T.onAccent, fontSize: 16, fontWeight: "700" },
  pickOptionSub:   { color: `${T.onAccent}bb`, fontSize: 12, marginTop: 2 },

  /* Gallery option text overrides */
  // (re-using pickOptionTitle but gallery needs different colour — handled inline)

  /* Scanning stage */
  scanningWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImg: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0.3,
  },
  scanningOverlay: {
    alignItems: "center",
    gap: 8,
    padding: 32,
    backgroundColor: `${T.bg}cc`,
    borderRadius: 24,
    margin: 24,
  },
  scanningIcon:     {},
  scanningTitle:    { color: T.text, fontSize: 20, fontWeight: "700" },
  scanningSubtitle: { color: T.textDim, fontSize: 14 },

  /* Confirmation form — receipt thumbnail */
  thumbWrap: {
    borderRadius: 16,
    overflow: "hidden",
    height: 140,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: { width: "100%", height: "100%" },
  thumbBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${T.bg}dd`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  thumbBadgeTxt: { color: T.green, fontSize: 12, fontWeight: "600" },

  /* Amount card */
  amountCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: T.accentBorder,
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
  fieldLabel:       { color: T.textDim, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  fieldInput:       { color: T.text, fontSize: 16, padding: 0 },
  fieldRow:         { flexDirection: "row", alignItems: "center" },
  fieldValue:       { flex: 1, color: T.text, fontSize: 15, fontWeight: "500" },
  fieldPlaceholder: { flex: 1, color: T.textMuted, fontSize: 15 },
  fieldChevron:     { marginLeft: 6 },
  catDot:           { width: 10, height: 10, borderRadius: 5, marginRight: 10 },

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
  catList:    { paddingBottom: 8 },
  catRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.border },
  catRowSelected: { backgroundColor: `${T.accent}0d`, marginHorizontal: -18, paddingHorizontal: 18 },
  catName:    { flex: 1, color: T.text, fontSize: 15 },
  catCheck:   { marginLeft: 8 },

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
