import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { FUNDING_OPTIONS, NEW_LOAN_SENTINEL, buildAppLocale } from "@/lib/constants";
import type { Category, ReceiptConfirmBody } from "@/lib/apiTypes";
import { currencySymbol } from "@/lib/formatting";
import type {
  ScanReceiptDateFields,
  ScanReceiptFundingSource,
  ScanReceiptPaymentSource,
  ScanReceiptScreenProps,
  ScanReceiptStage,
} from "@/types";
import { formatAppDate, translateExpenseCategoryName } from "@/lib/i18n";
import {
  getMobileApiErrorMessage,
  useConfirmReceiptMutation,
  useGetCategoriesQuery,
  useGetDebtsQuery,
  useGetSettingsQuery,
  useScanReceiptMutation,
} from "@/store/api";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";

function paymentSourceForFunding(funding: ScanReceiptFundingSource): ScanReceiptPaymentSource {
  if (funding === "savings") return "savings";
  if (funding === "credit_card") return "credit_card";
  if (funding === "monthly_allowance" || funding === "loan" || funding === "other") return "extra_untracked";
  return "income";
}

function parseDateFields(isoDate: string | null): ScanReceiptDateFields {
  const now = new Date();
  if (!isoDate) return { month: now.getMonth() + 1, year: now.getFullYear() };
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return { month: now.getMonth() + 1, year: now.getFullYear() };
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export function useScanReceiptScreenController(navigation: ScanReceiptScreenProps["navigation"]) {
  const topOffset = useTopHeaderOffset();
  const now = new Date();

  const [stage, setStage] = useState<ScanReceiptStage>("pick");
  const [scanError, setScanError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [fundingSource, setFundingSource] = useState<ScanReceiptFundingSource>("income");
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [newLoanName, setNewLoanName] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: debts = [] } = useGetDebtsQuery();
  const { data: settings = null } = useGetSettingsQuery();
  const [scanReceipt] = useScanReceiptMutation();
  const [confirmReceipt] = useConfirmReceiptMutation();

  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [fundingPickerOpen, setFundingPickerOpen] = useState(false);
  const [debtPickerOpen, setDebtPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  const closeCatPicker = useCallback(() => setCatPickerOpen(false), []);
  const closeFundingPicker = useCallback(() => setFundingPickerOpen(false), []);
  const closeDebtPicker = useCallback(() => setDebtPickerOpen(false), []);
  const closeMonthPicker = useCallback(() => setMonthPickerOpen(false), []);

  const {
    dragY: catPickerDragY,
    panHandlers: catPickerPanHandlers,
    resetDrag: resetCatPickerDrag,
  } = useSwipeDownToClose({
    onClose: closeCatPicker,
    disabled: stage === "saving",
  });

  const {
    dragY: fundingPickerDragY,
    panHandlers: fundingPickerPanHandlers,
    resetDrag: resetFundingPickerDrag,
  } = useSwipeDownToClose({
    onClose: closeFundingPicker,
    disabled: stage === "saving",
  });

  const {
    dragY: debtPickerDragY,
    panHandlers: debtPickerPanHandlers,
    resetDrag: resetDebtPickerDrag,
  } = useSwipeDownToClose({
    onClose: closeDebtPicker,
    disabled: stage === "saving",
  });

  const {
    dragY: monthPickerDragY,
    panHandlers: monthPickerPanHandlers,
    resetDrag: resetMonthPickerDrag,
  } = useSwipeDownToClose({
    onClose: closeMonthPicker,
    disabled: stage === "saving",
  });

  useEffect(() => {
    if (catPickerOpen) resetCatPickerDrag();
  }, [catPickerOpen, resetCatPickerDrag]);

  useEffect(() => {
    if (fundingPickerOpen) resetFundingPickerDrag();
  }, [fundingPickerOpen, resetFundingPickerDrag]);

  useEffect(() => {
    if (debtPickerOpen) resetDebtPickerDrag();
  }, [debtPickerOpen, resetDebtPickerDrag]);

  useEffect(() => {
    if (monthPickerOpen) resetMonthPickerDrag();
  }, [monthPickerOpen, resetMonthPickerDrag]);

  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== "scanning") return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer, stage]);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  const currency = currencySymbol(settings?.currency);
  const receiptLocale = buildAppLocale(settings?.language, settings?.country);

  const localizedMonthNamesLong = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) =>
        formatAppDate(new Date(2000, monthIndex, 1), {
          language: settings?.language,
          country: settings?.country,
          options: { month: "long" },
        }),
      ),
    [settings?.country, settings?.language],
  );

  const localizedMonthNamesShort = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => {
        const value = formatAppDate(new Date(2000, monthIndex, 1), {
          language: settings?.language,
          country: settings?.country,
          options: { month: "short" },
        });
        return value.replace(/\.$/u, "");
      }),
    [settings?.country, settings?.language],
  );

  const displayCategories = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        name: translateExpenseCategoryName(category.name, settings?.language),
      })),
    [categories, settings?.language],
  );

  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const cardDebts = debts.filter((d) => d.type === "credit_card" || d.type === "store_card");
  const loanDebts = debts.filter((d) => d.type === "loan" || d.type === "mortgage" || d.type === "hire_purchase" || d.type === "other");
  const needsDebtChoice = fundingSource === "credit_card" || fundingSource === "loan";
  const usingNewLoan = fundingSource === "loan" && selectedDebtId === NEW_LOAN_SENTINEL;
  const debtChoiceValid = !needsDebtChoice || (selectedDebtId.length > 0 && (!usingNewLoan || newLoanName.trim().length > 0));
  const canSave = name.trim().length > 0 && parsedAmount > 0 && !!receiptId && debtChoiceValid;
  const selectedCategory = displayCategories.find((c) => c.id === categoryId);
  const fundingLabel = FUNDING_OPTIONS.find((f) => f.value === fundingSource)?.label ?? "Income";
  const debtChoices = fundingSource === "credit_card" ? cardDebts : loanDebts;
  const selectedDebt = debtChoices.find((d) => d.id === selectedDebtId);

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
  }, [cardDebts, fundingSource, loanDebts, selectedDebtId]);

  const applySuggestedCategory = useCallback((suggestion: string | null, cats: Category[]) => {
    if (!suggestion || cats.length === 0) return;
    const lower = suggestion.toLowerCase();
    const match = cats.find((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()));
    if (match) setCategoryId(match.id);
  }, []);

  const handleImage = useCallback(
    async (base64: string, uri: string) => {
      setPreviewUri(uri);
      setStage("scanning");
      setScanError(null);
      try {
        const result = await scanReceipt({ image: base64 }).unwrap();
        setReceiptId(result.receiptId);
        setName(result.merchant ?? "");
        setAmount(result.amount != null ? String(result.amount) : "");
        const { month: nextMonth, year: nextYear } = parseDateFields(result.date);
        setMonth(nextMonth);
        setYear(nextYear);
        applySuggestedCategory(result.suggestedCategory, categories);
        setStage("confirm");
      } catch (e) {
        setScanError(getMobileApiErrorMessage(e, "Scan failed. Please try again."));
        setStage("pick");
      }
    },
    [applySuggestedCategory, categories, scanReceipt],
  );

  const launchCamera = useCallback(async () => {
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
  }, [handleImage]);

  const launchGallery = useCallback(async () => {
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
  }, [handleImage]);

  const handleConfirm = useCallback(async () => {
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

      await confirmReceipt({ receiptId, body: confirmBody }).unwrap();
      navigation.goBack();
    } catch (e) {
      setSaveError(getMobileApiErrorMessage(e, "Failed to save expense. Try again."));
      setStage("confirm");
    }
  }, [
    canSave,
    categoryId,
    confirmReceipt,
    fundingSource,
    month,
    name,
    navigation,
    newLoanName,
    parsedAmount,
    receiptId,
    selectedDebtId,
    year,
  ]);

  return {
    amount,
    canSave,
    catPickerDragY,
    catPickerOpen,
    catPickerPanHandlers,
    categoryId,
    closeCatPicker,
    closeDebtPicker,
    closeFundingPicker,
    closeMonthPicker,
    currency,
    debtChoices,
    debtPickerDragY,
    debtPickerOpen,
    debtPickerPanHandlers,
    displayCategories,
    fundingLabel,
    fundingPickerDragY,
    fundingPickerOpen,
    fundingPickerPanHandlers,
    fundingSource,
    handleConfirm,
    launchCamera,
    launchGallery,
    localizedMonthNamesLong,
    localizedMonthNamesShort,
    month,
    monthPickerDragY,
    monthPickerOpen,
    monthPickerPanHandlers,
    name,
    needsDebtChoice,
    newLoanName,
    parsedAmount,
    pickerYear,
    previewUri,
    receiptLocale,
    saveError,
    scanError,
    selectedCategory,
    selectedDebt,
    selectedDebtId,
    setAmount,
    setCatPickerOpen,
    setCategoryId,
    setDebtPickerOpen,
    setFundingPickerOpen,
    setFundingSource,
    setMonth,
    setMonthPickerOpen,
    setName,
    setNewLoanName,
    setPickerYear,
    setSelectedDebtId,
    setYear,
    shimmerOpacity,
    stage,
    topOffset,
    usingNewLoan,
    year,
    settings,
  };
}

export type ScanReceiptScreenController = ReturnType<typeof useScanReceiptScreenController>;
