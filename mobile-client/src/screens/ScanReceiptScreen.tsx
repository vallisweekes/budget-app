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
  Settings,
  ReceiptScanResponse,
  ReceiptConfirmBody,
} from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
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
  const [month,        setMonth]       = useState(now.getMonth() + 1);
  const [year,         setYear]        = useState(now.getFullYear());

  /* ── Data ───────────────────────────────────────────────── */
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings,   setSettings]   = useState<Settings | null>(null);

  /* ── UI pickers ─────────────────────────────────────────── */
  const [catPickerOpen,   setCatPickerOpen]   = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear,      setPickerYear]      = useState(year);

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
  const canSave = name.trim().length > 0 && parsedAmount > 0 && !!receiptId;
  const selectedCategory = categories.find((c) => c.id === categoryId);

  /* ── Load support data ───────────────────────────────────── */
  const loadSupportData = useCallback(async () => {
    try {
      const [cats, s] = await Promise.all([
        apiFetch<Category[]>("/api/bff/categories"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setSettings(s);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => { void loadSupportData(); }, [loadSupportData]);

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
      };
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
          {/* Header */}
          <View style={[s.header, { paddingTop: topOffset + 12 }]}>
            <Pressable onPress={() => setStage("pick")} hitSlop={12} style={s.backBtn}>
              <Ionicons name="chevron-back" size={22} color={T.text} />
            </Pressable>
            <View style={s.headerCenter}>
              <Text style={s.headerTitle}>Confirm Expense</Text>
              <Text style={s.headerSub}>from receipt scan</Text>
            </View>
            <View style={s.backBtn} />
          </View>

          <ScrollView style={s.flex} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
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
        <Modal visible={catPickerOpen} transparent animationType="slide" onRequestClose={() => setCatPickerOpen(false)}>
          <View style={s.modalOverlay}>
            <Pressable style={s.modalBackdrop} onPress={() => setCatPickerOpen(false)} />
            <View style={s.modalSheet}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>Category</Text>
              <ScrollView contentContainerStyle={s.catList}>
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
                    {categoryId === c.id && <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Month picker */}
        <Modal visible={monthPickerOpen} transparent animationType="slide" onRequestClose={() => setMonthPickerOpen(false)}>
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
                {SHORT_MONTHS.map((mName, idx) => {
                  const m = idx + 1;
                  const isSelected = m === month && pickerYear === year;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => { setMonth(m); setYear(pickerYear); setMonthPickerOpen(false); }}
                      style={[s.pickerCell, isSelected && s.pickerCellSelected]}
                    >
                      <Text style={[s.pickerCellText, isSelected && s.pickerCellSelectedText]}>{mName}</Text>
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

  /* ── Render: Pick method (initial / retry) ───────────────── */
  return (
    <SafeAreaView style={s.safe} edges={[]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topOffset + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Scan Receipt</Text>
          <Text style={s.headerSub}>AI powered</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      <View style={s.pickWrap}>
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
  headerTitle:  { color: T.text, fontSize: 17, fontWeight: "700" },
  headerSub:    { color: T.accent, fontSize: 11, fontWeight: "600", marginTop: 1, textTransform: "uppercase", letterSpacing: 0.8 },

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
