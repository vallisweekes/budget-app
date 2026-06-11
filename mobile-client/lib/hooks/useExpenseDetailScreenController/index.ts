import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { apiFetch } from "@/lib/api";
import type { Expense, ExpenseFrequencyPoint, ExpenseFrequencyResponse } from "@/lib/apiTypes";
import { getCachedPayPeriodExpenses, setCachedPayPeriodExpenses } from "@/lib/expensePeriodCache";
import { T } from "@/lib/theme";
import { clearScheduledUnpaidReminders, notifyPaymentStatus, scheduleUnpaidFollowUpReminders, scheduleUnpaidReminder } from "@/lib/unpaidReminder";
import type { ExpensesStackParamList } from "@/navigation/types";
import { getMobileApiErrorMessage, useDeleteExpenseMutation, useUpdateExpenseMutation } from "@/store/api";
import type { ExpenseDetailScreenControllerState, FrequencyDisplay, FrequencyIndicator, LoadState, MonthPoint, SparkState } from "@/types/ExpenseDetailScreen.types";
import {
  PAYMENT_EDIT_GRACE_DAYS,
  buildPeriodLabels,
  compareMonthYear,
  dueDateColor,
  formatDueDateLabel,
  formatUpdatedLabel,
  getPaymentStatusGraceNote,
  indicatorLabel,
  monthLabel,
  nextNMonths,
  resolveLogoUri,
} from "@/components/ExpenseDetailScreen/utils";
import {
  getFutureExpensePaymentWarning,
  isWithinPaymentEditGrace,
  unpaidDebtWarning,
} from "@/lib/domain/paymentRules";

type Props = NativeStackScreenProps<ExpensesStackParamList, "ExpenseDetail">;

function buildLoadState(params: {
  expenses: Expense[];
  expenseId: string;
  categoryId: string;
}): LoadState {
  const list = Array.isArray(params.expenses) ? params.expenses : [];
  const expense = list.find((entry) => entry.id === params.expenseId) ?? null;
  const effectiveCategoryId = expense?.categoryId ?? params.categoryId;

  return {
    expense,
    categoryExpenses: list.filter((entry) => entry.categoryId === effectiveCategoryId),
  };
}

export function useExpenseDetailScreenController({ route, navigation }: Props): ExpenseDetailScreenControllerState {
  const [updateExpense] = useUpdateExpenseMutation();
  const [deleteExpenseMutation] = useDeleteExpenseMutation();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { settings } = useBootstrapData();
  const tabBarHeight = useMemo(() => Math.max(insets.bottom, 56), [insets.bottom]);
  const { expenseId, expenseName, categoryId, month, year, budgetPlanId, currency } = route.params;
  const cachedExpenses = useMemo(
    () => getCachedPayPeriodExpenses({ budgetPlanId, month, year }) ?? [],
    [budgetPlanId, month, year],
  );
  const initialData = useMemo(
    () => buildLoadState({ expenses: cachedExpenses, expenseId, categoryId }),
    [cachedExpenses, categoryId, expenseId],
  );

  const [loading, setLoading] = useState(() => !initialData.expense);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LoadState>(initialData);
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
  const [, setFrequencyResolved] = useState(false);
  const [today, setToday] = useState(() => new Date());
  const shouldShowFrequencyCard = false;

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    try {
      setError(null);
      const cached = !force ? getCachedPayPeriodExpenses({ budgetPlanId, month, year }) : null;
      if (cached) {
        const nextState = buildLoadState({ expenses: cached, expenseId, categoryId });
        if (nextState.expense) {
          setData(nextState);
          return;
        }
      }

      const query = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const all = await apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}&scope=pay_period${query}`, {
        cacheTtlMs: 0,
      });
      const list = Array.isArray(all) ? all : [];
      setCachedPayPeriodExpenses({ budgetPlanId, month, year }, list);
      setData(buildLoadState({ expenses: list, expenseId, categoryId }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load");
      setData({ expense: null, categoryExpenses: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, categoryId, expenseId, month, year]);

  useEffect(() => {
    if (!initialData.expense) return;
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  useFocusEffect(
    useCallback(() => {
      setToday(new Date());
      if (data.expense?.id === expenseId) return;
      setLoading(true);
      void load();
    }, [data.expense?.id, expenseId, load]),
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
  const fundingSourceLabel = useMemo(() => {
    const source = String(expense?.paymentSource ?? "income").trim().toLowerCase();
    if (source === "savings") return "Savings";
    if (source === "emergency") return "Emergency fund";
    if (source === "credit_card") return "Card";
    if (source === "monthly_allowance") return "Allowance";
    if (source === "loan") return "Loan";
    if (source === "investment") return "Investments";
    if (source === "other") return "Other";
    return "Income";
  }, [expense?.paymentSource]);
  const canEditPaidPayment = isPaid && isWithinPaymentEditGrace(expense?.lastPaymentAt);
  const statusGraceNote = useMemo(() => getPaymentStatusGraceNote(expense?.lastPaymentAt), [expense?.lastPaymentAt]);

  const dueDays = useMemo(() => {
    const raw = expense?.dueDate;
    if (!raw) return null;
    const iso = String(raw).length >= 10 ? String(raw).slice(0, 10) : String(raw);
    const parsed = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.round((parsed.getTime() - today.getTime()) / 86_400_000);
  }, [expense?.dueDate, today]);

  const shouldShowStatusGraceNote = useMemo(() => {
    if (!isPaid || !canEditPaidPayment) return false;
    if (dueDays == null || dueDays > 0) return false;
    const payDate = Number(settings?.payDate);
    if (!Number.isFinite(payDate) || payDate <= 0) return true;
    return today.getDate() > payDate;
  }, [canEditPaidPayment, dueDays, isPaid, settings?.payDate, today]);

  const unpaidWarningText = useMemo(() => unpaidDebtWarning(dueDays), [dueDays]);
  const updatedLabel = expense ? formatUpdatedLabel(expense.lastPaymentAt) : "";
  const displayName = String((expense?.name || expenseName) ?? "");
  const logoUri = useMemo(() => resolveLogoUri(expense?.logoUrl), [expense?.logoUrl]);
  const showLogo = Boolean(logoUri) && !logoFailed;
  const monthsForFuture = useMemo(() => nextNMonths(month, year, 6), [month, year]);
  const editPeriodContext = useMemo(() => buildPeriodLabels({
    month,
    year,
    payDate: settings?.payDate,
    payFrequency: settings?.payFrequency,
    payAnchorDate: settings?.payAnchorDate ?? null,
  }), [month, settings?.payAnchorDate, settings?.payDate, settings?.payFrequency, year]);

  useEffect(() => {
    if (!expense || !shouldShowFrequencyCard) {
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
        if (!cancelled) {
          setFrequencyLoading(false);
          setFrequencyResolved(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expense, shouldShowFrequencyCard]);

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

  const hasFutureSpread = useMemo(() => {
    if (!frequency?.points?.length) return false;
    return frequency.points.some((point) => {
      if (!point.present) return false;
      return compareMonthYear({ month: point.month, year: point.year }, { month, year }) > 0;
    });
  }, [frequency?.points, month, year]);

  const shouldOfferFutureDeleteScope = useMemo(() => {
    if (!expense) return false;
    // Regular planned expenses may belong to a recurring series even when future points are not yet resolved.
    return !expense.isExtraLoggedExpense;
  }, [expense]);

  const deleteConfirmDescription = useMemo(() => {
    if (!shouldOfferFutureDeleteScope) {
      return `Are you sure you want to delete "${expense?.name ?? expenseName}"? This cannot be undone.`;
    }
    if (hasFutureSpread) {
      return `Choose how to delete "${expense?.name ?? expenseName}": only this month, or this month plus all future months/years.`;
    }
    return `Choose how to delete "${expense?.name ?? expenseName}": only this month, or this month plus all future months/years with the same schedule.`;
  }, [expense?.name, expenseName, hasFutureSpread, shouldOfferFutureDeleteScope]);

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
    await load({ force: true });
  }, [load]);

  const confirmFutureExpensePayment = useCallback(async () => {
    const warning = getFutureExpensePaymentWarning({
      dueDate: expense?.effectiveDueDate ?? expense?.dueDate,
      payDate: settings?.payDate,
      payFrequency: settings?.payFrequency,
      payAnchorDate: settings?.payAnchorDate ?? null,
      planCreatedAt: settings?.setupCompletedAt ?? settings?.accountCreatedAt ?? null,
    });
    if (!warning) return true;

    return await new Promise<boolean>((resolve) => {
      Alert.alert(
        warning.title,
        warning.description,
        [
          { text: "No", style: "cancel", onPress: () => resolve(false) },
          { text: "Yes", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  }, [expense?.dueDate, expense?.effectiveDueDate, settings?.accountCreatedAt, settings?.payAnchorDate, settings?.payDate, settings?.payFrequency, settings?.setupCompletedAt]);

  const onSavePayment = useCallback(async () => {
    if (!expense || paying) return;
    const delta = Number.parseFloat(String(payAmount ?? ""));
    if (!Number.isFinite(delta) || delta <= 0) return;
    const nextPaid = Math.min(amountNum, paidNum + delta);
    const nextIsPaid = nextPaid >= amountNum - 0.005;

    if (nextIsPaid) {
      const shouldProceed = await confirmFutureExpensePayment();
      if (!shouldProceed) return;
    }

    setPaying(true);
    try {
      const body: Record<string, unknown> = { paidAmount: nextPaid, paid: nextIsPaid };
      if (nextIsPaid && expense.paymentSource && expense.paymentSource !== "income") {
        body.paymentSource = expense.paymentSource;
        if (expense.cardDebtId) body.cardDebtId = expense.cardDebtId;
      }
      await updateExpense({ id: expense.id, changes: body }).unwrap();
      if (nextIsPaid) void clearScheduledUnpaidReminders({ expenseId: expense.id });
      void notifyPaymentStatus({ expenseId: expense.id, status: "paid", expenseName: expense.name });
      await loadAndClosePaymentSheet();
    } catch (error) {
      Alert.alert("Payment failed", getMobileApiErrorMessage(error, "Unknown error"));
    } finally {
      setPaying(false);
    }
  }, [amountNum, confirmFutureExpensePayment, expense, loadAndClosePaymentSheet, paidNum, payAmount, paying, updateExpense]);

  const onMarkPaid = useCallback(async () => {
    if (!expense || paying) return;

    const shouldProceed = await confirmFutureExpensePayment();
    if (!shouldProceed) return;

    setPaying(true);
    try {
      const body: Record<string, unknown> = { paidAmount: amountNum, paid: true };
      if (expense.paymentSource && expense.paymentSource !== "income") {
        body.paymentSource = expense.paymentSource;
        if (expense.cardDebtId) body.cardDebtId = expense.cardDebtId;
      }
      await updateExpense({ id: expense.id, changes: body }).unwrap();
      void clearScheduledUnpaidReminders({ expenseId: expense.id });
      await loadAndClosePaymentSheet();
    } catch (error) {
      Alert.alert("Update failed", getMobileApiErrorMessage(error, "Unknown error"));
    } finally {
      setPaying(false);
    }
  }, [amountNum, confirmFutureExpensePayment, expense, loadAndClosePaymentSheet, paying, updateExpense]);

  const markUnpaid = useCallback(async () => {
    if (!expense || paying) return;
    setPaying(true);
    try {
      await updateExpense({ id: expense.id, changes: { paidAmount: 0, paid: false } }).unwrap();
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
    } catch (error) {
      Alert.alert("Update failed", getMobileApiErrorMessage(error, "Unknown error"));
    } finally {
      setPaying(false);
    }
  }, [expense, isPaid, loadAndClosePaymentSheet, month, paying, updateExpense, year]);

  const deleteExpenseWithScope = useCallback(async (scope: "single" | "future") => {
    if (!expense || deleting) return;
    setDeleting(true);
    try {
      await deleteExpenseMutation({ id: expense.id, scope }).unwrap();
      navigation.goBack();
    } catch (error) {
      setError(getMobileApiErrorMessage(error, "Failed to delete expense"));
    } finally {
      setDeleting(false);
    }
  }, [deleteExpenseMutation, deleting, expense, navigation]);

  const onConfirmDelete = useCallback(async () => {
    if (!expense || deleting) return;
    setDeleteConfirmOpen(false);
    await deleteExpenseWithScope("single");
  }, [deleteExpenseWithScope, deleting, expense]);

  const onConfirmDeleteFuture = useCallback(async () => {
    if (!expense || deleting) return;
    setDeleteConfirmOpen(false);
    await deleteExpenseWithScope("future");
  }, [deleteExpenseWithScope, deleting, expense]);

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
    fundingSourceLabel,
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
    shouldShowFrequencyCard,
    shouldShowStatusGraceNote,
    showBottomActions: expense ? !isPaid : false,
    showDeleteScopeChoices: shouldOfferFutureDeleteScope,
    showLogo,
    showQuickActions: !isLoggedNonIncomeExpense,
    showRetryState: Boolean(error || !expense),
    showSkeleton: loading,
    spark,
    statusGraceNote,
    tabBarHeight,
    unpaidConfirmOpen,
    unpaidWarningText,
    updatedLabel,
    deleteConfirmDescription,
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
    onConfirmDeleteFuture,
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
      void load({ force: true });
    },
    onRetry: () => {
      setRefreshing(true);
      void load({ force: true });
    },
    onSaveEdit: () => {
      void load({ force: true });
    },
    onSavePayment,
  };
}

export default useExpenseDetailScreenController;