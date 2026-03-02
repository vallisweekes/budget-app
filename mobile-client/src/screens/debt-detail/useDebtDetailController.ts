import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { apiFetch } from "@/lib/api";
import type { CreditCard, Debt, DebtPayment, Settings } from "@/lib/apiTypes";
import { currencySymbol, fmt } from "@/lib/formatting";

type Params = {
  debtId: string;
  debtName: string;
  onDeleted: () => void;
};

export function useDebtDetailController({ debtId, debtName, onDeleted }: Params) {
  const [debt, setDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payAmount, setPayAmount] = useState("");
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editMonthlyPayment, setEditMonthlyPayment] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editInstallment, setEditInstallment] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPaymentSource, setEditPaymentSource] = useState<"income" | "extra_funds" | "credit_card">("income");
  const [editPaymentCardDebtId, setEditPaymentCardDebtId] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const currency = currencySymbol(settings?.currency);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [detail, paymentRows, appSettings, cardRows] = await Promise.all([
        apiFetch<Debt>(`/api/bff/debts/${debtId}`),
        apiFetch<DebtPayment[]>(`/api/bff/debts/${debtId}/payments`),
        apiFetch<Settings>("/api/bff/settings"),
        apiFetch<CreditCard[]>("/api/bff/credit-cards"),
      ]);
      setDebt(detail);
      setPayments(paymentRows);
      setSettings(appSettings);
      setCards(Array.isArray(cardRows) ? cardRows : []);
      setEditName(detail.name);
      setEditRate(detail.interestRate != null ? String(detail.interestRate) : "");
      setEditMonthlyPayment(
        detail.computedMonthlyPayment != null
          ? String(detail.computedMonthlyPayment)
          : ((detail as any).amount != null ? String((detail as any).amount) : "")
      );
      setEditMin(detail.monthlyMinimum != null ? String(detail.monthlyMinimum) : "");
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
  }, [debtId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (editPaymentSource !== "credit_card" && editPaymentCardDebtId) {
      setEditPaymentCardDebtId("");
    }
  }, [editPaymentCardDebtId, editPaymentSource]);

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
    setPayments((prev) => [{ id: `optimistic-${Date.now()}`, amount: String(appliedAmount), paidAt: new Date().toISOString(), notes: null }, ...prev]);
    setPayAmount("");
    setPaySheetOpen(false);

    try {
      setPaying(true);
      await apiFetch(`/api/bff/debts/${debtId}/payments`, { method: "POST", body: { amount: appliedAmount } });
      await load();
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
    const name = editName.trim();
    if (!name) {
      Alert.alert("Name required");
      return;
    }

    const installmentMonthsParsed = editInstallment.trim() ? Number.parseInt(editInstallment.trim(), 10) : null;
    const installmentMonths = Number.isFinite(installmentMonthsParsed as any) && (installmentMonthsParsed as number) > 0
      ? (installmentMonthsParsed as number)
      : null;

    if (editPaymentSource === "credit_card" && !editPaymentCardDebtId.trim()) {
      Alert.alert("Card required", "Select the source card for this debt payment.");
      return;
    }

    try {
      setEditSaving(true);
      await apiFetch(`/api/bff/debts/${debtId}`, {
        method: "PATCH",
        body: {
          name,
          amount: editMonthlyPayment ? parseFloat(editMonthlyPayment) : null,
          interestRate: editRate ? parseFloat(editRate) : null,
          monthlyMinimum: editMin ? parseFloat(editMin) : null,
          installmentMonths,
          dueDate: editDueDate || null,
          defaultPaymentSource: editPaymentSource,
          defaultPaymentCardDebtId: editPaymentSource === "credit_card" ? editPaymentCardDebtId.trim() : null,
        },
      });
      setEditing(false);
      await load();
    } catch (err: unknown) {
      Alert.alert("Update failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEditSaving(false);
    }
  }, [debtId, editDueDate, editInstallment, editMin, editMonthlyPayment, editName, editPaymentCardDebtId, editPaymentSource, editRate, load]);

  const confirmDeleteDebt = useCallback(async () => {
    try {
      setDeletingDebt(true);
      await apiFetch(`/api/bff/debts/${debtId}`, { method: "DELETE" });
      setDeleteConfirmOpen(false);
      onDeleted();
    } catch (err: unknown) {
      Alert.alert("Delete failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeletingDebt(false);
    }
  }, [debtId, onDeleted]);

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

    const paidInDueMonth = dueMonthKey
      ? payments.reduce((sum, payment) => {
          const paidAt = new Date(payment.paidAt);
          if (!Number.isFinite(paidAt.getTime())) return sum;
          const key = `${paidAt.getUTCFullYear()}-${String(paidAt.getUTCMonth() + 1).padStart(2, "0")}`;
          return key === dueMonthKey ? sum + parseFloat(payment.amount) : sum;
        }, 0)
      : 0;

    const dueTarget = (() => {
      if (!debt) return 0;
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
      if (monthlyMinNum != null && monthlyMinNum > 0) planned = Math.max(planned, monthlyMinNum);

      planned = Number.isFinite(planned) ? Math.max(0, planned) : 0;
      return Math.min(currentBalance, planned);
    })();
    const dueTargetSafe = Number.isFinite(dueTarget) ? (dueTarget as number) : 0;
    const dueCoveredThisCycle = Boolean(dueTargetSafe > 0 && paidInDueMonth >= dueTargetSafe && dueDateValue && dueDateValue.getTime() >= Date.now());
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
  }, [debt, payments]);

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
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    deletingDebt,
    editing,
    setEditing,
    editName,
    setEditName,
    editRate,
    setEditRate,
    editMonthlyPayment,
    setEditMonthlyPayment,
    editMin,
    setEditMin,
    editInstallment,
    setEditInstallment,
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
