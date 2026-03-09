import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSwipeDownToClose } from "@/hooks";

import { apiFetch } from "@/lib/api";
import type { Category, Debt, Settings } from "@/lib/apiTypes";
import { FUNDING_OPTIONS, NEW_LOAN_SENTINEL } from "@/lib/constants";
import { buildPayPeriodFromMonthAnchor, normalizePayFrequency } from "@/lib/payPeriods";

export type FundingSource = "income" | "savings" | "monthly_allowance" | "credit_card" | "loan" | "other";

function paymentSourceForFunding(funding: FundingSource): "income" | "savings" | "credit_card" | "extra_untracked" {
  if (funding === "savings") return "savings";
  if (funding === "credit_card") return "credit_card";
  if (funding === "monthly_allowance" || funding === "loan" || funding === "other") return "extra_untracked";
  return "income";
}

export function useUnplannedExpenseScreenController(
  onSuccess: () => void,
  initialPeriod?: { month?: number; year?: number },
): ReturnType<typeof useUnplannedExpenseScreenControllerImpl>;
export function useUnplannedExpenseScreenController(params: {
  onSuccess: () => void;
  initialPeriod?: { month?: number; year?: number };
}): ReturnType<typeof useUnplannedExpenseScreenControllerImpl>;
export function useUnplannedExpenseScreenController(
  onSuccessOrParams: (() => void) | {
    onSuccess: () => void;
    initialPeriod?: { month?: number; year?: number };
  },
  initialPeriodArg?: { month?: number; year?: number },
) {
  const params = typeof onSuccessOrParams === "function"
    ? { onSuccess: onSuccessOrParams, initialPeriod: initialPeriodArg }
    : onSuccessOrParams;

  return useUnplannedExpenseScreenControllerImpl(params);
}

function useUnplannedExpenseScreenControllerImpl(params: {
  onSuccess: () => void;
  initialPeriod?: { month?: number; year?: number };
}) {
  const { onSuccess, initialPeriod } = params;
  const now = new Date();
  const initialMonth = Number(initialPeriod?.month);
  const initialYear = Number(initialPeriod?.year);
  const resolvedInitialMonth = Number.isFinite(initialMonth) && initialMonth >= 1 && initialMonth <= 12
    ? Math.floor(initialMonth)
    : now.getMonth() + 1;
  const resolvedInitialYear = Number.isFinite(initialYear)
    ? Math.floor(initialYear)
    : now.getFullYear();

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
  const [month, setMonth] = useState(resolvedInitialMonth);
  const [year, setYear] = useState(resolvedInitialYear);

  const [categories, setCategories] = useState<Category[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [fundingPickerOpen, setFundingPickerOpen] = useState(false);
  const [debtPickerOpen, setDebtPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(resolvedInitialYear);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const closeCatPicker = useCallback(() => setCatPickerOpen(false), []);
  const closeFundingPicker = useCallback(() => setFundingPickerOpen(false), []);
  const closeDebtPicker = useCallback(() => setDebtPickerOpen(false), []);
  const closeMonthPicker = useCallback(() => setMonthPickerOpen(false), []);

  const { dragY: catPickerDragY, panHandlers: catPickerPanHandlers, resetDrag: resetCatPickerDrag } = useSwipeDownToClose({ onClose: closeCatPicker });
  const { dragY: fundingPickerDragY, panHandlers: fundingPickerPanHandlers, resetDrag: resetFundingPickerDrag } = useSwipeDownToClose({ onClose: closeFundingPicker });
  const { dragY: debtPickerDragY, panHandlers: debtPickerPanHandlers, resetDrag: resetDebtPickerDrag } = useSwipeDownToClose({ onClose: closeDebtPicker });
  const { dragY: monthPickerDragY, panHandlers: monthPickerPanHandlers, resetDrag: resetMonthPickerDrag } = useSwipeDownToClose({ onClose: closeMonthPicker });

  useEffect(() => { if (catPickerOpen) resetCatPickerDrag(); }, [catPickerOpen, resetCatPickerDrag]);
  useEffect(() => { if (fundingPickerOpen) resetFundingPickerDrag(); }, [fundingPickerOpen, resetFundingPickerDrag]);
  useEffect(() => { if (debtPickerOpen) resetDebtPickerDrag(); }, [debtPickerOpen, resetDebtPickerDrag]);
  useEffect(() => { if (monthPickerOpen) resetMonthPickerDrag(); }, [monthPickerOpen, resetMonthPickerDrag]);

  const parsedAmount = useMemo(() => parseFloat(amount.replace(/,/g, "")), [amount]);
  const cardDebts = useMemo(() => debts.filter((debt) => debt.type === "credit_card" || debt.type === "store_card"), [debts]);
  const loanDebts = useMemo(() => debts.filter((debt) => debt.type === "loan" || debt.type === "mortgage" || debt.type === "hire_purchase" || debt.type === "other"), [debts]);
  const needsDebtChoice = fundingSource === "credit_card" || fundingSource === "loan";
  const usingNewLoan = fundingSource === "loan" && selectedDebtId === NEW_LOAN_SENTINEL;
  const debtChoiceValid = !needsDebtChoice || (selectedDebtId.length > 0 && (!usingNewLoan || newLoanName.trim().length > 0));
  const canSubmit = name.trim().length > 0 && parsedAmount > 0 && debtChoiceValid && !submitting;

  const selectedCategory = useMemo(() => categories.find((category) => category.id === categoryId), [categories, categoryId]);
  const fundingLabel = useMemo(() => FUNDING_OPTIONS.find((item) => item.value === fundingSource)?.label ?? "Income", [fundingSource]);
  const debtChoices = fundingSource === "credit_card" ? cardDebts : loanDebts;
  const selectedDebt = useMemo(() => debtChoices.find((debt) => debt.id === selectedDebtId), [debtChoices, selectedDebtId]);

  const load = useCallback(async () => {
    try {
      const [loadedCategories, debtList, loadedSettings] = await Promise.all([
        apiFetch<Category[]>("/api/bff/categories"),
        apiFetch<Debt[]>("/api/bff/debts"),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setCategories(Array.isArray(loadedCategories) ? loadedCategories : []);
      setDebts(Array.isArray(debtList) ? debtList : []);
      setSettings(loadedSettings);
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
        if (categoryTouchedRef.current || categoryIdRef.current) return;
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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (fundingSource === "credit_card") {
      if (cardDebts.length === 1) setSelectedDebtId(cardDebts[0]!.id);
      else if (!cardDebts.some((debt) => debt.id === selectedDebtId)) setSelectedDebtId("");
      setNewLoanName("");
      return;
    }

    if (fundingSource === "loan") {
      if (selectedDebtId === NEW_LOAN_SENTINEL) return;
      if (!loanDebts.some((debt) => debt.id === selectedDebtId)) setSelectedDebtId("");
      return;
    }

    setSelectedDebtId("");
    setNewLoanName("");
  }, [fundingSource, cardDebts, loanDebts, selectedDebtId]);

  const handleSubmit = useCallback(async () => {
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
        isExtraLoggedExpense: true,
        fundingSource,
        paymentSource: paymentSourceForFunding(fundingSource),
      };
      const payDateForResolution = Number.isFinite(settings?.payDate as number) && (settings?.payDate as number) >= 1
        ? Math.floor(settings?.payDate as number)
        : 1;
      const payFrequencyForResolution = normalizePayFrequency(settings?.payFrequency);
      const payPeriod = buildPayPeriodFromMonthAnchor({
        year,
        month,
        payDate: payDateForResolution,
        payFrequency: payFrequencyForResolution,
      });

      body.periodKey = payPeriod.start.toISOString().slice(0, 10);
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
      onSuccess();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to log expense. Try again.");
      setSubmitting(false);
    }
  }, [canSubmit, categoryId, fundingSource, month, name, newLoanName, onSuccess, parsedAmount, selectedDebtId, settings?.payDate, settings?.payFrequency, year]);

  return {
    amount,
    canSubmit,
    cardDebts,
    catPickerDragY,
    catPickerOpen,
    catPickerPanHandlers,
    categories,
    categoryId,
    closeCatPicker,
    closeDebtPicker,
    closeFundingPicker,
    closeMonthPicker,
    debtChoices,
    debtPickerDragY,
    debtPickerOpen,
    debtPickerPanHandlers,
    fundingLabel,
    fundingPickerDragY,
    fundingPickerOpen,
    fundingPickerPanHandlers,
    fundingSource,
    handleSubmit,
    loadingData,
    month,
    monthPickerDragY,
    monthPickerOpen,
    monthPickerPanHandlers,
    name,
    needsDebtChoice,
    newLoanName,
    parsedAmount,
    pickerYear,
    selectedCategory,
    selectedDebt,
    selectedDebtId,
    setAmount,
    setCatPickerOpen,
    setCategoryId,
    setCategoryTouched,
    setDebtPickerOpen,
    setFundingPickerOpen,
    setFundingSource,
    setMonth,
    setMonthPickerOpen,
    setName,
    setNewLoanName,
    setPickerYear,
    setSelectedDebtId,
    setSubmitting,
    setYear,
    settings,
    submitError,
    submitting,
    usingNewLoan,
    year,
  };
}