import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { apiFetch } from "@/lib/api";
import type { CreditCard, Debt, DebtPayment, DebtSummaryItem, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { getCachedDebtCreditCards, getCachedDebtSummaryItem } from "@/lib/debtDetailCache";
import {
  useCreateDebtPaymentMutation,
  useDeleteDebtMutation,
  useGetCreditCardsQuery,
  useLazyGetDebtDetailQuery,
  useLazyGetDebtPaymentsQuery,
  useUpdateDebtMutation,
} from "@/store/api";

type Params = {
  debtId: string;
  debtName: string;
  onDeleted: (debtId: string) => void;
  onDeleteFailed?: (debtId: string) => void;
};

export function useDebtDetailController({ debtId, debtName, onDeleted, onDeleteFailed }: Params) {
  const { settings: bootstrapSettings, ensureLoaded } = useBootstrapData();
  const [summarySnapshot, setSummarySnapshot] = useState<DebtSummaryItem | null>(() => getCachedDebtSummaryItem(debtId));
  const [debt, setDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(bootstrapSettings);
  const [cards, setCards] = useState<CreditCard[]>(() => getCachedDebtCreditCards());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);

  const [payAmount, setPayAmount] = useState("");
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCurrentBalance, setEditCurrentBalance] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editMonthlyPayment, setEditMonthlyPayment] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editInstallment, setEditInstallment] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPaymentSource, setEditPaymentSource] = useState<"income" | "extra_funds" | "credit_card">("income");
  const [editPaymentCardDebtId, setEditPaymentCardDebtId] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [createDebtPaymentMutation] = useCreateDebtPaymentMutation();
  const [updateDebtMutation] = useUpdateDebtMutation();
  const [deleteDebtMutation] = useDeleteDebtMutation();
  const [fetchDebtDetail] = useLazyGetDebtDetailQuery();
  const [fetchDebtPayments] = useLazyGetDebtPaymentsQuery();
  const creditCardsQuery = useGetCreditCardsQuery();

  const currency = currencySymbol(settings?.currency);

  const asTwoDecimals = useCallback((value: unknown): string => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
  }, []);

  const roundMoney = useCallback((value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }, []);

  const roundMoneyUp = useCallback((value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.ceil(value * 100) / 100;
  }, []);

  const computeInstallmentPayment = useCallback((balance: number, months: number, minimum: number) => {
    if (!Number.isFinite(balance) || balance < 0) return null;
    if (!Number.isFinite(months) || months <= 0) return null;
    const floor = Number.isFinite(minimum) && minimum > 0 ? minimum : 0;
    return roundMoneyUp(Math.max(balance / months, floor));
  }, [roundMoneyUp]);

  const computeRemainingInstallmentMonths = useCallback((balance: number, payment: number) => {
    if (!Number.isFinite(balance) || balance < 0) return null;
    if (!Number.isFinite(payment) || payment <= 0) return null;
    return Math.max(1, Math.ceil((balance - 0.000001) / payment));
  }, []);

  useEffect(() => {
    if (!bootstrapSettings) return;
    setSettings((prev) => prev ?? bootstrapSettings);
  }, [bootstrapSettings]);

  useEffect(() => {
    if (!Array.isArray(creditCardsQuery.data)) return;
    setCards(creditCardsQuery.data);
  }, [creditCardsQuery.data]);

  const loadPayments = useCallback(async () => {
    const paymentRows = await fetchDebtPayments(debtId, true).unwrap();
    setPayments(paymentRows);
    setPaymentsLoaded(true);
    return paymentRows;
  }, [debtId, fetchDebtPayments]);

  const load = useCallback(async (options?: { includePayments?: boolean }) => {
    try {
      setError(null);
      const shouldLoadPayments = options?.includePayments === true;
      const shouldLoadCards = cards.length === 0;
      const shouldEnsureSettings = !bootstrapSettings && !settings;

      const [detail, paymentRows, bootstrapResult, cardRows] = await Promise.all([
        fetchDebtDetail(debtId, true).unwrap(),
        shouldLoadPayments ? loadPayments() : Promise.resolve<DebtPayment[] | null>(null),
        shouldEnsureSettings
          ? ensureLoaded()
          : Promise.resolve({ dashboard: null, settings: bootstrapSettings ?? settings }),
        shouldLoadCards
          ? creditCardsQuery.refetch().then((result) => (Array.isArray(result.data) ? result.data : null))
          : Promise.resolve<CreditCard[] | null>(null),
      ]);

      const nextSettings = bootstrapResult.settings ?? bootstrapSettings ?? settings;
      setDebt(detail);
      if (paymentRows) {
        setPayments(paymentRows);
        setPaymentsLoaded(true);
      }
      if (nextSettings) {
        setSettings(nextSettings);
      }
      if (cardRows) {
        setCards(Array.isArray(cardRows) ? cardRows : []);
      }
      setSummarySnapshot((prev) => prev ?? getCachedDebtSummaryItem(debtId));
      setEditName(detail.name);
      setEditCurrentBalance(asTwoDecimals(detail.currentBalance));
      setEditRate(detail.interestRate != null ? asTwoDecimals(detail.interestRate) : "");
      setEditMonthlyPayment(
        detail.computedMonthlyPayment != null
          ? asTwoDecimals(detail.computedMonthlyPayment)
          : ((detail as any).amount != null ? asTwoDecimals((detail as any).amount) : "")
      );
      setEditMin(detail.monthlyMinimum != null ? asTwoDecimals(detail.monthlyMinimum) : "");
      setEditInstallment(detail.installmentMonths != null ? String(detail.installmentMonths) : "");
      setEditDueDate(detail.dueDate ? String(detail.dueDate).slice(0, 10) : "");
      setEditPaymentSource(detail.defaultPaymentSource ?? "income");
      setEditPaymentCardDebtId(detail.defaultPaymentCardDebtId ?? "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load debt");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [asTwoDecimals, bootstrapSettings, cards.length, creditCardsQuery, debtId, ensureLoaded, fetchDebtDetail, loadPayments, settings]);

  useEffect(() => {
    if (editPaymentSource !== "credit_card" && editPaymentCardDebtId) {
      setEditPaymentCardDebtId("");
    }
  }, [editPaymentCardDebtId, editPaymentSource]);

  const handleEditCurrentBalanceChange = useCallback((value: string) => {
    setEditCurrentBalance(value);

    const months = editInstallment.trim() ? Number.parseInt(editInstallment.trim(), 10) : NaN;
    if (!Number.isFinite(months) || months <= 0) return;

    const balance = value.trim() ? Number.parseFloat(value) : NaN;
    const payment = editMonthlyPayment.trim() ? Number.parseFloat(editMonthlyPayment) : NaN;
    const minimum = editMin.trim() ? Number.parseFloat(editMin) : 0;
    const effectivePayment = Number.isFinite(payment) && payment > 0
      ? Math.max(payment, Number.isFinite(minimum) ? minimum : 0)
      : NaN;

    const nextMonths = computeRemainingInstallmentMonths(balance, effectivePayment);
    if (nextMonths != null) {
      setEditInstallment(String(nextMonths));
    }
  }, [computeRemainingInstallmentMonths, editInstallment, editMin, editMonthlyPayment]);

  const handleEditInstallmentChange = useCallback((value: string) => {
    setEditInstallment(value);

    const months = value.trim() ? Number.parseInt(value.trim(), 10) : NaN;
    if (!Number.isFinite(months) || months <= 0) return;

    const balance = editCurrentBalance.trim() ? Number.parseFloat(editCurrentBalance) : NaN;
    const minimum = editMin.trim() ? Number.parseFloat(editMin) : 0;
    const nextPayment = computeInstallmentPayment(balance, months, minimum);
    if (nextPayment != null) {
      setEditMonthlyPayment(nextPayment.toFixed(2));
    }
  }, [computeInstallmentPayment, editCurrentBalance, editMin]);

  const handleEditMonthlyPaymentChange = useCallback((value: string) => {
    setEditMonthlyPayment(value);

    const months = editInstallment.trim() ? Number.parseInt(editInstallment.trim(), 10) : NaN;
    if (!Number.isFinite(months) || months <= 0) return;

    const balance = editCurrentBalance.trim() ? Number.parseFloat(editCurrentBalance) : NaN;
    const payment = value.trim() ? Number.parseFloat(value) : NaN;
    const minimum = editMin.trim() ? Number.parseFloat(editMin) : 0;
    const effectivePayment = Number.isFinite(payment) && payment > 0
      ? Math.max(payment, Number.isFinite(minimum) ? minimum : 0)
      : NaN;

    const nextMonths = computeRemainingInstallmentMonths(balance, effectivePayment);
    if (nextMonths != null) {
      setEditInstallment(String(nextMonths));
    }
  }, [computeRemainingInstallmentMonths, editCurrentBalance, editInstallment, editMin]);

  const handleEditMinChange = useCallback((value: string) => {
    setEditMin(value);

    const months = editInstallment.trim() ? Number.parseInt(editInstallment.trim(), 10) : NaN;
    if (!Number.isFinite(months) || months <= 0) return;

    const balance = editCurrentBalance.trim() ? Number.parseFloat(editCurrentBalance) : NaN;
    const minimum = value.trim() ? Number.parseFloat(value) : 0;
    const nextPayment = computeInstallmentPayment(balance, months, minimum);
    if (nextPayment != null) {
      setEditMonthlyPayment(nextPayment.toFixed(2));
    }
  }, [computeInstallmentPayment, editCurrentBalance, editInstallment]);

  const submitPayment = useCallback(async (amount: number) => {
    if (!debt) return;
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid payment amount.");
      return;
    }

    const currentBal = parseFloat(debt.currentBalance);
    if (amount > currentBal) {
      Alert.alert("Amount too high", `Balance remaining is ${fmt(currentBal, currency)}.`);
      return;
    }

    const currentPaid = parseFloat(debt.paidAmount);
    const appliedAmount = Math.min(amount, currentBal);
    const nextBalance = Math.max(0, currentBal - appliedAmount);
    const nextPaidAmount = Math.max(0, currentPaid + appliedAmount);
    const debtSnapshot = debt;
    const paymentsSnapshot = payments;

    setDebt({ ...debt, currentBalance: String(nextBalance), paidAmount: String(nextPaidAmount), paid: nextBalance <= 0 });
    setPaymentsLoaded(true);
    setPayments((prev) => [{ id: `optimistic-${Date.now()}`, amount: String(appliedAmount), paidAt: new Date().toISOString(), notes: null }, ...prev]);
    setPayAmount("");
    setPaySheetOpen(false);

    try {
      setPaying(true);
      await createDebtPaymentMutation({ debtId, amount: appliedAmount }).unwrap();
      await Promise.all([load(), loadPayments()]);
    } catch (err: unknown) {
      setDebt(debtSnapshot);
      setPayments(paymentsSnapshot);
      Alert.alert("Payment failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPaying(false);
    }
  }, [currency, debt, debtId, load, payments]);

  const handlePay = useCallback(async () => {
    const amount = parseFloat(payAmount);
    await submitPayment(amount);
  }, [payAmount, submitPayment]);

  const handleEdit = useCallback(async () => {
    if (!debt) return;
    const name = editName.trim();
    if (!name) {
      Alert.alert("Name required");
      return;
    }

    const installmentMonthsParsed = editInstallment.trim() ? Number.parseInt(editInstallment.trim(), 10) : null;
    const installmentMonths = Number.isFinite(installmentMonthsParsed as any) && (installmentMonthsParsed as number) > 0
      ? (installmentMonthsParsed as number)
      : null;

    const parsedCurrentBalance = editCurrentBalance ? parseFloat(editCurrentBalance) : NaN;
    if (!Number.isFinite(parsedCurrentBalance) || parsedCurrentBalance < 0) {
      Alert.alert("Invalid current balance", "Enter a valid current balance.");
      return;
    }

    if (editPaymentSource === "credit_card" && !editPaymentCardDebtId.trim()) {
      Alert.alert("Card required", "Select the source card for this debt payment.");
      return;
    }

    const parsedMonthlyPayment = editMonthlyPayment ? parseFloat(editMonthlyPayment) : NaN;
    const parsedInterestRate = editRate ? parseFloat(editRate) : NaN;
    const nextDueDate = editDueDate || null;
    const nextDueDay = nextDueDate ? Number.parseInt(nextDueDate.slice(8, 10), 10) : null;

    const parsedMin = editMin ? parseFloat(editMin) : NaN;
    const monthlyMinimum = Number.isFinite(parsedMin) && parsedMin > 0 ? parsedMin : null;

    // For credit/store cards the monthly minimum IS the planned payment.
    // Keep amount in sync so the list card and detail page always agree.
    const isCardType = debt.type === "credit_card" || debt.type === "store_card";
    const installmentChanged = installmentMonths !== (debt.installmentMonths ?? null);
    const normalizedMonthlyPayment = !isCardType && installmentMonths != null
      ? (installmentChanged
          ? computeInstallmentPayment(parsedCurrentBalance, installmentMonths, monthlyMinimum ?? 0)
          : (() => {
              const effective = Number.isFinite(parsedMonthlyPayment)
                ? Math.max(parsedMonthlyPayment, monthlyMinimum ?? 0)
                : NaN;
              return Number.isFinite(effective) && effective > 0 ? effective : null;
            })())
      : null;
    const normalizedInstallmentMonths = !isCardType && installmentMonths != null
      ? (installmentChanged
          ? installmentMonths
          : computeRemainingInstallmentMonths(
              parsedCurrentBalance,
              normalizedMonthlyPayment ?? (Number.isFinite(parsedMonthlyPayment) ? parsedMonthlyPayment : NaN)
            ))
      : installmentMonths;

    const effectiveAmount = isCardType && monthlyMinimum != null
      ? monthlyMinimum
      : (normalizedMonthlyPayment ?? (Number.isFinite(parsedMonthlyPayment) ? parsedMonthlyPayment : null));

    const optimisticDebt: Debt = {
      ...debt,
      name,
      currentBalance: parsedCurrentBalance.toFixed(2),
      paid: parsedCurrentBalance <= 0,
      amount: effectiveAmount != null ? effectiveAmount.toFixed(2) : null,
      monthlyMinimum: monthlyMinimum != null ? monthlyMinimum.toFixed(2) : null,
      interestRate: Number.isFinite(parsedInterestRate) ? parsedInterestRate.toFixed(2) : null,
      installmentMonths: normalizedInstallmentMonths ?? installmentMonths,
      dueDate: nextDueDate,
      dueDay: Number.isFinite(nextDueDay as number) ? (nextDueDay as number) : null,
      defaultPaymentSource: editPaymentSource,
      defaultPaymentCardDebtId: editPaymentSource === "credit_card" ? editPaymentCardDebtId.trim() : null,
      computedMonthlyPayment: effectiveAmount ?? debt.computedMonthlyPayment,
    };

    const debtSnapshot = debt;
    setDebt(optimisticDebt);
    setEditing(false);

    try {
      setEditSaving(true);
      await updateDebtMutation({
        id: debtId,
        changes: {
          name,
          currentBalance: Number(parsedCurrentBalance.toFixed(2)),
          amount: effectiveAmount != null ? Number(effectiveAmount.toFixed(2)) : null,
          monthlyMinimum: monthlyMinimum != null ? Number(monthlyMinimum.toFixed(2)) : null,
          interestRate: editRate ? Number(parseFloat(editRate).toFixed(2)) : null,
          installmentMonths: normalizedInstallmentMonths ?? installmentMonths,
          dueDate: editDueDate || null,
          defaultPaymentSource: editPaymentSource,
          defaultPaymentCardDebtId: editPaymentSource === "credit_card" ? editPaymentCardDebtId.trim() : null,
        },
      }).unwrap();
      await load();
    } catch (err: unknown) {
      setDebt(debtSnapshot);
      setEditing(true);
      Alert.alert("Update failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEditSaving(false);
    }
  }, [computeInstallmentPayment, computeRemainingInstallmentMonths, debt, debtId, editCurrentBalance, editDueDate, editInstallment, editMin, editMonthlyPayment, editName, editPaymentCardDebtId, editPaymentSource, editRate, load]);

  const confirmDeleteDebt = useCallback(async () => {
    if (deletingDebt) return;
    setDeletingDebt(true);
    setDeleteConfirmOpen(false);
    onDeleted(debtId);

    try {
      await deleteDebtMutation({ id: debtId }).unwrap();
    } catch (err: unknown) {
      setDeletingDebt(false);
      onDeleteFailed?.(debtId);
      Alert.alert("Delete failed", err instanceof Error ? err.message : "Unknown error");
    }
  }, [debtId, deleteDebtMutation, deletingDebt, onDeleteFailed, onDeleted]);

  const derived = useMemo(() => {
    const currentBalNum = debt ? parseFloat(debt.currentBalance) : 0;
    const originalBalNum = debt ? parseFloat((debt as Debt & { initialBalance?: string }).initialBalance ?? debt.originalBalance ?? "0") : 0;
    const paidSoFarNum = debt ? Math.max(0, parseFloat(debt.paidAmount || "0")) : 0;
    const interestRateNum = debt?.interestRate != null ? parseFloat(debt.interestRate) : null;
    const monthlyMinNum = debt?.monthlyMinimum != null ? parseFloat(debt.monthlyMinimum) : null;
    const creditLimitNum = debt?.creditLimit != null ? parseFloat(debt.creditLimit) : null;
    const dueDateValue = debt?.dueDate ? new Date(debt.dueDate) : null;
    const dueDateLabel = dueDateValue && Number.isFinite(dueDateValue.getTime())
      ? dueDateValue.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "Not set";

    const dueMonthKey = dueDateValue && Number.isFinite(dueDateValue.getTime())
      ? `${dueDateValue.getUTCFullYear()}-${String(dueDateValue.getUTCMonth() + 1).padStart(2, "0")}`
      : null;

    const summaryPaidThisMonth = Number(summarySnapshot?.paidThisMonth ?? 0);
    const paidInDueMonth = paymentsLoaded
      ? (dueMonthKey
          ? payments.reduce((sum, payment) => {
              const paidAt = new Date(payment.paidAt);
              if (!Number.isFinite(paidAt.getTime())) return sum;
              const key = `${paidAt.getUTCFullYear()}-${String(paidAt.getUTCMonth() + 1).padStart(2, "0")}`;
              return key === dueMonthKey ? sum + parseFloat(payment.amount) : sum;
            }, 0)
          : 0)
      : Math.max(0, summaryPaidThisMonth);

    const dueTarget = (() => {
      if (!debt) return 0;
      if (summarySnapshot?.dueThisMonth != null) {
        return Math.max(0, Number(summarySnapshot.dueThisMonth));
      }
      if (debt.computedMonthlyPayment != null) return debt.computedMonthlyPayment;

      const currentBalance = currentBalNum;
      const installmentMonths = debt.installmentMonths != null ? Number(debt.installmentMonths) : 0;
      const amount = (debt as any)?.amount != null ? parseFloat(String((debt as any).amount)) : 0;

      let planned = 0;
      if (Number.isFinite(installmentMonths) && installmentMonths > 0) {
        const principal = originalBalNum > 0 ? originalBalNum : currentBalance;
        if (principal > 0) planned = principal / installmentMonths;
      }

      if (!(planned > 0) && Number.isFinite(amount) && amount > 0) planned = amount;
      if (!(planned > 0) && debt.sourceType === "expense") planned = currentBalance;

      // For credit/store cards the monthly minimum IS the planned payment.
      const isCardType = debt.type === "credit_card" || debt.type === "store_card";
      if (isCardType && monthlyMinNum != null && monthlyMinNum > 0) {
        planned = monthlyMinNum;
      } else if (monthlyMinNum != null && monthlyMinNum > 0) {
        planned = Math.max(planned, monthlyMinNum);
      }

      planned = Number.isFinite(planned) ? Math.max(0, planned) : 0;
      return Math.min(currentBalance, planned);
    })();
    const dueTargetSafe = Number.isFinite(dueTarget) ? (dueTarget as number) : 0;
    const dueCoveredThisCycle = paymentsLoaded
      ? Boolean(dueTargetSafe > 0 && paidInDueMonth >= dueTargetSafe && dueDateValue && dueDateValue.getTime() >= Date.now())
      : Boolean(summarySnapshot?.isPaymentMonthPaid ?? (dueTargetSafe > 0 && paidInDueMonth >= dueTargetSafe && dueDateValue && dueDateValue.getTime() >= Date.now()));
    const dueRemainingThisCycle = Math.max(0, dueTargetSafe - paidInDueMonth);
    const isOverdue = Boolean(
      dueDateValue &&
      new Date().getTime() > dueDateValue.getTime() + 5 * 24 * 60 * 60 * 1000 &&
      currentBalNum > 0
    );
    const isCardDebt = debt?.type === "credit_card" || debt?.type === "store_card";
    const isPaid = debt ? (debt.paid || currentBalNum <= 0) : false;
    const progressPct = originalBalNum > 0 ? Math.min(100, (paidSoFarNum / originalBalNum) * 100) : currentBalNum > 0 ? 0 : 100;

    return {
      currentBalNum,
      originalBalNum,
      paidSoFarNum,
      interestRateNum,
      monthlyMinNum,
      dueTarget: dueTargetSafe,
      dueRemainingThisCycle,
      creditLimitNum,
      dueDateLabel,
      dueCoveredThisCycle,
      isOverdue,
      isCardDebt,
      isPaid,
      progressPct,
    };
  }, [debt, payments, paymentsLoaded, summarySnapshot]);

  const togglePaymentHistory = useCallback(() => {
    setPaymentHistoryOpen((prev) => {
      const next = !prev;
      if (next && !paymentsLoaded) {
        void loadPayments();
      }
      return next;
    });
  }, [loadPayments, paymentsLoaded]);

  const handleMarkPaid = useCallback(async () => {
    if (!debt) return;
    const currentBal = parseFloat(debt.currentBalance);
    const dueNow = Math.max(0, derived.dueRemainingThisCycle > 0 ? derived.dueRemainingThisCycle : derived.dueTarget);
    const amountToApply = Math.min(currentBal, dueNow);
    if (!(amountToApply > 0)) return;
    await submitPayment(amountToApply);
  }, [debt, derived.dueRemainingThisCycle, derived.dueTarget, submitPayment]);

  const availablePaymentCards = useMemo(
    () => cards.filter((card) => card.id !== debtId),
    [cards, debtId]
  );

  return {
    debt,
    debtName,
    payments,
    settings,
    currency,
    loading,
    refreshing,
    error,
    load,
    setRefreshing,
    payAmount,
    setPayAmount,
    paySheetOpen,
    setPaySheetOpen,
    paying,
    paymentHistoryOpen,
    setPaymentHistoryOpen,
    togglePaymentHistory,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    deletingDebt,
    editing,
    setEditing,
    editName,
    setEditName,
    editCurrentBalance,
    handleEditCurrentBalanceChange,
    editRate,
    setEditRate,
    editMonthlyPayment,
    handleEditMonthlyPaymentChange,
    editMin,
    handleEditMinChange,
    editInstallment,
    handleEditInstallmentChange,
    editDueDate,
    setEditDueDate,
    editPaymentSource,
    setEditPaymentSource,
    editPaymentCardDebtId,
    setEditPaymentCardDebtId,
    availablePaymentCards,
    showDatePicker,
    setShowDatePicker,
    editSaving,
    handlePay,
    handleMarkPaid,
    handleEdit,
    confirmDeleteDebt,
    derived,
  };
}
