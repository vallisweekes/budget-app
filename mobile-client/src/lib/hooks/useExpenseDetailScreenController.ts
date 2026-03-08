import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/lib/api";
import type { Expense, ExpenseFrequencyPoint, ExpenseFrequencyResponse, Settings } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { clearScheduledUnpaidReminders, notifyPaymentStatus, scheduleUnpaidFollowUpReminders, scheduleUnpaidReminder } from "@/lib/unpaidReminder";
import type { ExpensesStackParamList } from "@/navigation/types";
import type { ExpenseDetailScreenControllerState, FrequencyDisplay, FrequencyIndicator, LoadState, MonthPoint, SparkState } from "@/screens/expenseDetail/types";
import {
  PAYMENT_EDIT_GRACE_DAYS,
  buildExpenseTips,
  buildPeriodLabels,
  compareMonthYear,
  dueDateColor,
  formatDueDateLabel,
  formatUpdatedLabel,
  getPaymentStatusGraceNote,
  indicatorLabel,
  isWithinPaymentEditGrace,
  monthLabel,
  nextNMonths,
  resolveLogoUri,
  unpaidDebtWarning,
} from "@/screens/expenseDetail/utils";

type Props = NativeStackScreenProps<ExpensesStackParamList, "ExpenseDetail">;

export function useExpenseDetailScreenController({ route, navigation }: Props): ExpenseDetailScreenControllerState {
  const { height, width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { expenseId, expenseName, categoryId, month, year, budgetPlanId, currency } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LoadState>({ expense: null, categoryExpenses: [] });
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [unpaidConfirmOpen, setUnpaidConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [frequency, setFrequency] = useState<ExpenseFrequencyResponse | null>(null);
  const [frequencyLoading, setFrequencyLoading] = useState(false);
  const [frequencyResolved, setFrequencyResolved] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      const query = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const [all, settingsData] = await Promise.all([
        apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}&scope=pay_period${query}`),
        apiFetch<Settings>("/api/bff/settings"),
      ]);
      const list = Array.isArray(all) ? all : [];
      const found = list.find((entry) => entry.id === expenseId) ?? await apiFetch<Expense>(`/api/bff/expenses/${encodeURIComponent(expenseId)}`, {
        cacheTtlMs: 0,
        skipOnUnauthorized: true,
      }).catch(() => null);
      const effectiveCategoryId = found?.categoryId ?? categoryId;
      const inCategory = list.filter((entry) => entry.categoryId === effectiveCategoryId);
      setData({ expense: found, categoryExpenses: inCategory });
      setSettings(settingsData ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load");
      setData({ expense: null, categoryExpenses: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, categoryId, expenseId, month, year]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const expense = data.expense;

  useEffect(() => {
    setLogoFailed(false);
  }, [expense?.id, expense?.logoUrl]);

  const amountNum = expense ? Number(expense.amount) : 0;
  const paidNum = expense ? Number(expense.paidAmount) : 0;
  const remainingNum = Math.max(0, amountNum - paidNum);
  const isPaid = amountNum <= 0 ? true : paidNum >= amountNum - 0.005;
  const isLoggedNonIncomeExpense = Boolean(expense?.isExtraLoggedExpense) && String(expense?.paymentSource ?? "income") !== "income";
  const canEditPaidPayment = isPaid && isWithinPaymentEditGrace(expense?.lastPaymentAt);
  const statusGraceNote = useMemo(() => getPaymentStatusGraceNote(expense?.lastPaymentAt), [expense?.lastPaymentAt]);

  const dueDays = useMemo(() => {
    const raw = expense?.dueDate;
    if (!raw) return null;
    const iso = String(raw).length >= 10 ? String(raw).slice(0, 10) : String(raw);
    const parsed = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.round((parsed.getTime() - Date.now()) / 86_400_000);
  }, [expense?.dueDate]);

  const shouldShowStatusGraceNote = useMemo(() => {
    if (!isPaid || !canEditPaidPayment) return false;
    if (dueDays == null || dueDays > 0) return false;
    const payDate = Number(settings?.payDate);
    if (!Number.isFinite(payDate) || payDate <= 0) return true;
    return new Date().getDate() > payDate;
  }, [canEditPaidPayment, dueDays, isPaid, settings?.payDate]);

  const unpaidWarningText = useMemo(() => unpaidDebtWarning(dueDays), [dueDays]);
  const updatedLabel = expense ? formatUpdatedLabel(expense.lastPaymentAt) : "";
  const displayName = String((expense?.name || expenseName) ?? "");
  const logoUri = useMemo(() => resolveLogoUri(expense?.logoUrl), [expense?.logoUrl]);
  const showLogo = Boolean(logoUri) && !logoFailed;
  const monthsForFuture = useMemo(() => nextNMonths(month, year, 6), [month, year]);
  const editPeriodContext = useMemo(() => buildPeriodLabels(month, year, settings?.payDate), [month, year, settings?.payDate]);

  useEffect(() => {
    if (!expense) {
      setFrequency(null);
      setFrequencyLoading(false);
      setFrequencyResolved(true);
      return;
    }
    let cancelled = false;
    setFrequencyResolved(false);
    setFrequencyLoading(true);
    void (async () => {
      try {
        const response = await apiFetch<ExpenseFrequencyResponse>(`/api/bff/expenses/${expense.id}/frequency?months=6`);
        if (cancelled) return;
        if (!response || typeof response !== "object" || !Array.isArray((response as { points?: unknown }).points)) {
          setFrequency(null);
          return;
        }
        setFrequency(response);
      } catch {
        if (!cancelled) setFrequency(null);
      } finally {
        if (cancelled) return;
        setFrequencyLoading(false);
        setFrequencyResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expense]);

  const missedBefore = useMemo(() => {
    const points = frequency?.points ?? [];
    return points.some((point) => {
      const isPastOrCurrent = compareMonthYear({ month: point.month, year: point.year }, { month, year }) <= 0;
      if (!isPastOrCurrent) return false;
      return point.status === "missed" || point.status === "unpaid" || point.status === "partial";
    });
  }, [frequency?.points, month, year]);

  const freqDisplay = useMemo<FrequencyDisplay>(() => {
    if (frequency?.points?.length) {
      const points: MonthPoint[] = (frequency.points as ExpenseFrequencyPoint[]).map((point) => ({
        key: point.key,
        month: point.month,
        year: point.year,
        label: point.label,
        ratio: Number(point.ratio) || 0,
        present: Boolean(point.present),
        status: point.status,
      }));
      return { subtitle: frequency.subtitle || "Payment frequency", points };
    }
    const points: MonthPoint[] = monthsForFuture.map(({ month: targetMonth, year: targetYear }) => ({
      key: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
      month: targetMonth,
      year: targetYear,
      label: monthLabel(targetMonth),
      ratio: 0,
      present: false,
      status: "upcoming",
    }));
    return { subtitle: "Next 6 months", points };
  }, [frequency, monthsForFuture]);

  const freqIndicator = useMemo<FrequencyIndicator | null>(() => {
    const historyOnly = freqDisplay.points.filter((point) => compareMonthYear({ month: point.month, year: point.year }, { month, year }) <= 0);
    if (!historyOnly.length) return null;
    const hasMissed = historyOnly.some((point) => point.status === "missed");
    const hasProblems = historyOnly.some((point) => point.status === "missed" || point.status === "unpaid" || point.status === "partial");
    const debtsCleared = frequency?.debt?.cleared ?? true;
    const kind: FrequencyIndicator["kind"] = hasMissed && !debtsCleared ? "bad" : hasProblems ? "moderate" : "good";
    const color = kind === "good" ? T.green : kind === "bad" ? T.red : T.orange;
    return { kind, label: indicatorLabel(kind), color };
  }, [freqDisplay.points, frequency?.debt?.cleared, month, year]);

  const hasFrequencyHistory = useMemo(() => {
    return freqDisplay.points.some((point) => compareMonthYear({ month: point.month, year: point.year }, { month, year }) <= 0 && Boolean(point.present));
  }, [freqDisplay.points, month, year]);

  const tips = useMemo(() => buildExpenseTips({
    displayName,
    currency,
    amountNum,
    remainingNum,
    isPaid,
    dueDays: dueDays ?? null,
    isDirectDebit: Boolean(expense?.isDirectDebit),
    month,
    year,
    points: freqDisplay.points,
    subtitle: freqDisplay.subtitle,
    missedBefore,
    debt: frequency?.debt,
    indicator: freqIndicator ? { label: freqIndicator.label } : null,
  }), [amountNum, currency, displayName, dueDays, expense?.isDirectDebit, freqDisplay.points, freqDisplay.subtitle, freqIndicator, frequency?.debt, isPaid, missedBefore, month, remainingNum, year]);

  useEffect(() => {
    setTipIndex(0);
  }, [expense?.id, tips.length]);

  useEffect(() => {
    if (tips.length <= 1) return;
    const intervalId = setInterval(() => {
      setTipIndex((previous) => (tips.length ? (previous + 1) % tips.length : 0));
    }, 20_000);
    return () => clearInterval(intervalId);
  }, [tips.length]);

  const spark = useMemo<SparkState>(() => {
    const points = freqDisplay.points;
    const count = points.length;
    const widthValue = Math.max(220, Math.round(width - 56));
    const heightValue = 54;
    const pad = 6;
    let lastKnownIndex = -1;
    for (let index = 0; index < count; index += 1) {
      if (points[index]?.present) lastKnownIndex = index;
    }
    const toXY = (index: number) => {
      const point = points[index];
      const ratio = point ? Math.max(0, Math.min(1, Number(point.ratio) || 0)) : 0;
      const x = count <= 1 ? widthValue / 2 : pad + (index * (widthValue - pad * 2)) / (count - 1);
      const y = pad + (1 - ratio) * (heightValue - pad * 2);
      return { x, y };
    };
    const poly = lastKnownIndex >= 0 ? Array.from({ length: lastKnownIndex + 1 }, (_, index) => toXY(index)) : [];
    return {
      w: widthValue,
      h: heightValue,
      pad,
      lastKnownIndex,
      polylinePoints: poly.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
      toXY,
    };
  }, [freqDisplay.points, width]);

  const loadAndClosePaymentSheet = useCallback(async () => {
    setPaySheetOpen(false);
    setPayAmount("");
    await load();
  }, [load]);

  const onSavePayment = useCallback(async () => {
    if (!expense || paying) return;
    const delta = Number.parseFloat(String(payAmount ?? ""));
    if (!Number.isFinite(delta) || delta <= 0) return;
    const nextPaid = Math.min(amountNum, paidNum + delta);
    const nextIsPaid = nextPaid >= amountNum - 0.005;
    setPaying(true);
    try {
      const body: Record<string, unknown> = { paidAmount: nextPaid, paid: nextIsPaid };
      if (nextIsPaid && expense.paymentSource && expense.paymentSource !== "income") {
        body.paymentSource = expense.paymentSource;
        if (expense.cardDebtId) body.cardDebtId = expense.cardDebtId;
      }
      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, { method: "PATCH", body });
      if (nextIsPaid) void clearScheduledUnpaidReminders({ expenseId: expense.id });
      void notifyPaymentStatus({ expenseId: expense.id, status: "paid", expenseName: expense.name });
      await loadAndClosePaymentSheet();
    } finally {
      setPaying(false);
    }
  }, [amountNum, expense, loadAndClosePaymentSheet, paidNum, payAmount, paying]);

  const onMarkPaid = useCallback(async () => {
    if (!expense || paying) return;
    setPaying(true);
    try {
      const body: Record<string, unknown> = { paidAmount: amountNum, paid: true };
      if (expense.paymentSource && expense.paymentSource !== "income") {
        body.paymentSource = expense.paymentSource;
        if (expense.cardDebtId) body.cardDebtId = expense.cardDebtId;
      }
      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, { method: "PATCH", body });
      void clearScheduledUnpaidReminders({ expenseId: expense.id });
      await loadAndClosePaymentSheet();
    } finally {
      setPaying(false);
    }
  }, [amountNum, expense, loadAndClosePaymentSheet, paying]);

  const markUnpaid = useCallback(async () => {
    if (!expense || paying) return;
    setPaying(true);
    try {
      await apiFetch<Expense>(`/api/bff/expenses/${expense.id}`, { method: "PATCH", body: { paidAmount: 0, paid: false } });
      void notifyPaymentStatus({ expenseId: expense.id, status: "unpaid", expenseName: expense.name });
      void scheduleUnpaidReminder({ expenseId: expense.id, expenseName: expense.name });
      void scheduleUnpaidFollowUpReminders({
        expenseId: expense.id,
        expenseName: expense.name,
        dueDate: expense.dueDate,
        month,
        year,
        wasPreviouslyPaid: isPaid,
      });
      await loadAndClosePaymentSheet();
    } finally {
      setPaying(false);
    }
  }, [expense, isPaid, loadAndClosePaymentSheet, month, paying, year]);

  const onConfirmDelete = useCallback(async () => {
    if (!expense || deleting) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/bff/expenses/${expense.id}`, { method: "DELETE" });
      navigation.goBack();
    } finally {
      setDeleting(false);
    }
  }, [deleting, expense, navigation]);

  return {
    amountNum,
    canEditPaidPayment,
    compactQuickRow: height <= 740,
    currency,
    deleteConfirmOpen,
    deleting,
    displayName,
    dueDateBadgeColor: dueDateColor(expense?.dueDate),
    dueDateLabel: formatDueDateLabel(expense?.dueDate),
    editPeriodContext,
    editSheetOpen,
    error,
    expense,
    expenseName,
    freqDisplay,
    freqIndicator,
    frequencyLoading,
    hasFrequencyHistory,
    height,
    insetsTop: insets.top,
    isLoggedNonIncomeExpense,
    isPaid,
    loading,
    lockedHintVisible: isPaid && !canEditPaidPayment && !isLoggedNonIncomeExpense,
    logoFailed,
    logoUri,
    paidNum,
    payAmount,
    paySheetOpen,
    paying,
    paymentEditGraceDays: PAYMENT_EDIT_GRACE_DAYS,
    refreshing,
    remainingNum,
    shouldShowFrequencyCard: true,
    shouldShowStatusGraceNote,
    showBottomActions: Boolean(expense && !isPaid),
    showLogo,
    showQuickActions: !isLoggedNonIncomeExpense,
    showRetryState: Boolean(error || !expense),
    showSkeleton: loading,
    spark,
    statusGraceNote,
    tabBarHeight,
    tipIndex,
    tips,
    unpaidConfirmOpen,
    unpaidWarningText,
    updatedLabel,
    onChangePayAmount: setPayAmount,
    onCloseDeleteConfirm: () => {
      if (deleting) return;
      setDeleteConfirmOpen(false);
    },
    onCloseEditSheet: () => setEditSheetOpen(false),
    onClosePaymentSheet: () => {
      if (paying) return;
      setPaySheetOpen(false);
    },
    onCloseUnpaidConfirm: () => {
      if (paying) return;
      setUnpaidConfirmOpen(false);
    },
    onConfirmDelete,
    onConfirmUnpaid: async () => {
      setUnpaidConfirmOpen(false);
      await markUnpaid();
    },
    onGoBack: () => navigation.goBack(),
    onLogoError: () => setLogoFailed(true),
    onMarkPaid,
    onOpenDeleteConfirm: () => setDeleteConfirmOpen(true),
    onOpenEditSheet: () => setEditSheetOpen(true),
    onOpenRecordPayment: () => {
      setPayAmount("");
      setPaySheetOpen(true);
    },
    onOpenUnpaidConfirm: () => setUnpaidConfirmOpen(true),
    onRefresh: () => {
      setRefreshing(true);
      void load();
    },
    onRetry: () => {
      setRefreshing(true);
      void load();
    },
    onSaveEdit: () => {
      void load();
    },
    onSavePayment,
  };
}

export default useExpenseDetailScreenController;