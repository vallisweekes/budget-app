import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { apiFetch } from "@/lib/api";
import type { Debt, DebtPayment, Settings } from "@/lib/apiTypes";
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
  const [editDue, setEditDue] = useState("");
  const [editInstallment, setEditInstallment] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAutoPay, setEditAutoPay] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const currency = currencySymbol(settings?.currency);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [detail, paymentRows, appSettings] = await Promise.all([
        apiFetch<Debt>(`/api/bff/debts/${debtId}`),
        apiFetch<DebtPayment[]>(`/api/bff/debts/${debtId}/payments`),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      setDebt(detail);
      setPayments(paymentRows);
      setSettings(appSettings);
      setEditName(detail.name);
      setEditRate(detail.interestRate != null ? String(detail.interestRate) : "");
      setEditMonthlyPayment((detail as any).amount != null ? String((detail as any).amount) : "");
      setEditMin(detail.monthlyMinimum != null ? String(detail.monthlyMinimum) : "");
      setEditDue(detail.dueDay != null ? String(detail.dueDay) : "");
      setEditInstallment(detail.installmentMonths != null ? String(detail.installmentMonths) : "");
      setEditDueDate(detail.dueDate ? String(detail.dueDate).slice(0, 10) : "");
      setEditAutoPay((detail.defaultPaymentSource ?? "income") === "income");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load debt");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debtId]);

  useEffect(() => { load(); }, [load]);

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

  const handleMarkPaid = useCallback(async () => {
    if (!debt) return;
    await submitPayment(parseFloat(debt.currentBalance));
  }, [debt, submitPayment]);

  const handleEdit = useCallback(async () => {
    const name = editName.trim();
    if (!name) {
      Alert.alert("Name required");
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
          dueDay: editDue ? parseInt(editDue, 10) : null,
          installmentMonths: editInstallment ? parseInt(editInstallment, 10) : null,
          dueDate: editDueDate || null,
          defaultPaymentSource: editAutoPay ? "income" : "extra_funds",
        },
      });
      setEditing(false);
      await load();
    } catch (err: unknown) {
      Alert.alert("Update failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEditSaving(false);
    }
  }, [debtId, editAutoPay, editDue, editDueDate, editInstallment, editMin, editName, editRate, load]);

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
      ? dueDateValue.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
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

    const dueTarget = debt?.computedMonthlyPayment != null
      ? debt.computedMonthlyPayment
      : ((debt as any)?.amount != null ? parseFloat(String((debt as any).amount)) : (monthlyMinNum ?? 0));
    const dueTargetSafe = Number.isFinite(dueTarget) ? (dueTarget as number) : 0;
    const dueCoveredThisCycle = Boolean(dueTargetSafe > 0 && paidInDueMonth >= dueTargetSafe && dueDateValue && dueDateValue.getTime() >= Date.now());
    const isMissed = Boolean(dueDateValue && new Date().getTime() > dueDateValue.getTime() + 5 * 24 * 60 * 60 * 1000 && currentBalNum > 0);
    const isOverdue = Boolean(dueDateValue && !isMissed && new Date().getTime() > dueDateValue.getTime() && currentBalNum > 0);
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
      creditLimitNum,
      dueDateLabel,
      dueCoveredThisCycle,
      isMissed,
      isOverdue,
      isCardDebt,
      isPaid,
      progressPct,
    };
  }, [debt, payments]);

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
    editDue,
    setEditDue,
    editInstallment,
    setEditInstallment,
    editDueDate,
    setEditDueDate,
    editAutoPay,
    setEditAutoPay,
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
