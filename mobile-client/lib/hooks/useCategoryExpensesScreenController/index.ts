import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { apiFetch, getApiMutationVersion } from "@/lib/api";
import type { Category, Expense, ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { resolveCategoryColor } from "@/lib/categoryColors";
import { PAYMENT_EDIT_GRACE_DAYS } from "@/lib/domain/paymentRules";
import { subscribeCategoryAddExpenseTrigger } from "@/lib/events/categoryAddExpenseTrigger";
import { getCachedPayPeriodExpenses, setCachedPayPeriodExpenses } from "@/lib/expensePeriodCache";
import { getLatestPaymentAt, splitCategoryExpenses } from "@/lib/helpers/categoryExpenses";
import { useTopHeaderOffset } from "@/hooks";
import { buildPayPeriodFromMonthAnchor, formatPayPeriodLabel, normalizePayFrequency, type PayFrequency } from "@/lib/payPeriods";
import type { ExpensesStackParamList } from "@/navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CategoryExpensesControllerState, CategoryExpensesSettingsSlice } from "@/types/CategoryExpensesScreen.types";
import type { AddExpenseSheetAddedPayload } from "@/types/components/AddExpenseSheet.types";

type Props = NativeStackScreenProps<ExpensesStackParamList, "CategoryExpenses">;

function parseRouteNumber(value: unknown, fallback: number) {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function parseNullableRouteString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
}

export function useCategoryExpensesScreenController({ navigation, route }: Props): CategoryExpensesControllerState {
  const topHeaderOffset = useTopHeaderOffset();
  const { settings } = useBootstrapData();
  const now = new Date();
  const fallbackMonth = now.getMonth() + 1;
  const fallbackYear = now.getFullYear();
  const {
    categoryId: rawCategoryId,
    categoryName: rawCategoryName,
    color: rawColor,
    icon: rawIcon,
    month: rawRouteMonth,
    year: rawRouteYear,
    budgetPlanId: rawBudgetPlanId,
    currency: rawCurrency,
  } = route.params;

  const categoryId = parseNullableRouteString(rawCategoryId) ?? "__none__";
  const categoryName = parseNullableRouteString(rawCategoryName) ?? "Category";
  const color = parseNullableRouteString(rawColor);
  const icon = parseNullableRouteString(rawIcon);
  const parsedMonth = parseRouteNumber(rawRouteMonth, fallbackMonth);
  const routeMonth = Math.min(12, Math.max(1, parsedMonth));
  const parsedYear = parseRouteNumber(rawRouteYear, fallbackYear);
  const routeYear = Math.max(2000, parsedYear);
  const budgetPlanId = parseNullableRouteString(rawBudgetPlanId);
  const currency = parseNullableRouteString(rawCurrency) ?? "£";

  const categoryColor = useMemo(() => resolveCategoryColor(color), [color]);
  const [month, setMonth] = useState(routeMonth);
  const [year, setYear] = useState(routeYear);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(routeYear);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [allCategoriesForAddSheet, setAllCategoriesForAddSheet] = useState<ExpenseCategoryBreakdown[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loggedPayments, setLoggedPayments] = useState<Expense[]>([]);
  const lastSyncedLoggedCountRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState<Record<string, boolean>>({});
  const [payDate, setPayDate] = useState<number | null>(null);
  const [payFrequency, setPayFrequency] = useState<PayFrequency>("monthly");
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const seenMutationVersionRef = useRef<number>(getApiMutationVersion());

  useEffect(() => {
    if (routeMonth !== month) setMonth(routeMonth);
    if (routeYear !== year) {
      setYear(routeYear);
    }
  }, [month, routeMonth, routeYear, year]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const qp = budgetPlanId ? `?budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
        const data = await apiFetch<Category[]>(`/api/bff/categories${qp}`);
        if (cancelled || !Array.isArray(data) || data.length === 0) return;

        setAllCategoriesForAddSheet(
          data.map((category) => ({
            categoryId: category.id,
            name: category.name,
            color: category.color,
            icon: category.icon,
            total: 0,
            paidTotal: 0,
            paidCount: 0,
            totalCount: 0,
          })),
        );
      } catch {
        if (!cancelled) setAllCategoriesForAddSheet(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [budgetPlanId]);

  const categoriesForAddSheet = useMemo<ExpenseCategoryBreakdown[]>(() => {
    if (Array.isArray(allCategoriesForAddSheet) && allCategoriesForAddSheet.length > 0) return allCategoriesForAddSheet;
    return [{ categoryId, name: categoryName, color, icon, total: 0, paidTotal: 0, paidCount: 0, totalCount: 0 }];
  }, [allCategoriesForAddSheet, categoryId, categoryName, color, icon]);

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    try {
      setError(null);
      const settingsSlice = {
        payDate: settings?.payDate ?? null,
        payFrequency: normalizePayFrequency(settings?.payFrequency),
      } satisfies CategoryExpensesSettingsSlice;

      const cachedAll = !force
        ? getCachedPayPeriodExpenses({ budgetPlanId, month, year })
        : null;

      if (cachedAll) {
        const split = splitCategoryExpenses(cachedAll, categoryId);
        setExpenses(split.main);
        setLoggedPayments(split.logged);
        setPayDate(settingsSlice.payDate);
        setPayFrequency(settingsSlice.payFrequency);
        setLogoFailed({});
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const all = await apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}&scope=pay_period&refreshLogos=1${qp}`);

      const allExpenses = Array.isArray(all) ? all : [];
      setCachedPayPeriodExpenses({ budgetPlanId, month, year }, allExpenses);

      const split = splitCategoryExpenses(allExpenses, categoryId);
      setExpenses(split.main);
      setLoggedPayments(split.logged);
      setPayDate(settingsSlice.payDate);
      setPayFrequency(settingsSlice.payFrequency);
      setLogoFailed({});
      seenMutationVersionRef.current = getApiMutationVersion();
    } catch (err) {
      const fallbackMessage = "Failed to load category expenses";
      setError(err instanceof Error ? (err.message || fallbackMessage) : fallbackMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, categoryId, month, settings?.payDate, settings?.payFrequency, year]);

  useFocusEffect(
    useCallback(() => {
      if (getApiMutationVersion() === seenMutationVersionRef.current) return;
      void load({ force: true });
    }, [load]),
  );

  useEffect(() => {
    const hasCache = Boolean(getCachedPayPeriodExpenses({ budgetPlanId, month, year }));
    if (!hasCache) {
      setLoading(true);
      setExpenses([]);
    }
    void load();
  }, [budgetPlanId, load, month, year]);

  useEffect(() => {
    const nextCount = loggedPayments.length;
    if (lastSyncedLoggedCountRef.current === nextCount) return;
    lastSyncedLoggedCountRef.current = nextCount;
    navigation.setParams({ loggedPaymentsCount: nextCount });
  }, [loggedPayments.length, navigation]);

  const plannedTotal = useMemo(() => expenses.reduce((sum, expense) => sum + Number(expense.amount), 0), [expenses]);
  const paidTotal = useMemo(() => expenses.reduce((sum, expense) => {
    const amount = Number(expense.amount);
    const paid = Number(expense.paidAmount);
    const paidClamped = amount > 0 ? Math.min(paid, amount) : 0;
    return sum + paidClamped;
  }, 0), [expenses]);
  const remainingTotal = useMemo(() => Math.max(plannedTotal - paidTotal, 0), [paidTotal, plannedTotal]);
  const paidPct = useMemo(() => (plannedTotal <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((paidTotal / plannedTotal) * 100)))), [paidTotal, plannedTotal]);
  const remainingPct = useMemo(() => (plannedTotal <= 0 ? 0 : Math.max(0, Math.min(100, 100 - paidPct))), [paidPct, plannedTotal]);
  const latestPaymentAt = useMemo(() => getLatestPaymentAt(expenses), [expenses]);
  const updatedLabel = useMemo(() => (!latestPaymentAt ? "Updated: —" : `Updated: ${new Date(latestPaymentAt).toLocaleDateString("en-GB")}`), [latestPaymentAt]);
  const heroPeriodLabel = useMemo(() => {
    const range = buildPayPeriodFromMonthAnchor({ year, month, payDate: payDate ?? 27, payFrequency });
    return formatPayPeriodLabel(range.start, range.end);
  }, [month, payDate, payFrequency, year]);

  const resolvePickerActualYear = useCallback((targetMonth: number, displayYear: number) => {
    if (payFrequency === "monthly" && targetMonth === 1) {
      return displayYear + 1;
    }
    return displayYear;
  }, [payFrequency]);

  const resolvePickerDisplayYear = useCallback((targetMonth: number, actualYear: number) => {
    if (payFrequency === "monthly" && targetMonth === 1) {
      return actualYear - 1;
    }
    return actualYear;
  }, [payFrequency]);

  useEffect(() => {
    setPickerYear((prev) => {
      const next = resolvePickerDisplayYear(month, year);
      return prev === next ? prev : next;
    });
  }, [month, resolvePickerDisplayYear, year]);

  const pickerMonths = useMemo(() => {
    if (payFrequency !== "monthly") {
      return Array.from({ length: 12 }, (_, index) => index + 1);
    }
    return [...Array.from({ length: 11 }, (_, index) => index + 2), 1];
  }, [payFrequency]);

  const enabledPeriodSet = useMemo(() => new Set(pickerMonths), [pickerMonths]);

  useEffect(() => {
    setCurrentTimestamp(Date.now());
  }, [month, payDate, payFrequency, year]);

  const canAddExpenseInSelectedPeriod = useMemo(() => {
    const range = buildPayPeriodFromMonthAnchor({ year, month, payDate: payDate ?? 27, payFrequency });
    const graceCutoff = new Date(range.end.getTime());
    graceCutoff.setHours(23, 59, 59, 999);
    graceCutoff.setDate(graceCutoff.getDate() + PAYMENT_EDIT_GRACE_DAYS);
    return currentTimestamp <= graceCutoff.getTime();
  }, [currentTimestamp, month, payDate, payFrequency, year]);

  useEffect(() => subscribeCategoryAddExpenseTrigger(() => {
    if (!canAddExpenseInSelectedPeriod) return;
    setAddSheetOpen(true);
  }), [canAddExpenseInSelectedPeriod]);

  const getPeriodOptionLabel = useCallback((targetMonth: number, targetYear: number) => {
    const actualYear = resolvePickerActualYear(targetMonth, targetYear);
    const period = buildPayPeriodFromMonthAnchor({
      month: targetMonth,
      year: actualYear,
      payDate: payDate ?? 27,
      payFrequency,
    });
    const startLabel = period.start.toLocaleString("en-GB", { month: "short" });
    const endLabel = period.end.toLocaleString("en-GB", { month: "short" });
    return `${startLabel} - ${endLabel}`;
  }, [payDate, payFrequency, resolvePickerActualYear]);

  const selectedPickerYear = resolvePickerDisplayYear(month, year);

  return {
    addSheetOpen,
    budgetPlanId,
    categoriesForAddSheet,
    categoryColor,
    categoryId,
    categoryName,
    color,
    currency,
    enabledPeriodSet,
    error,
    expenses,
    heroPeriodLabel,
    loading,
    loggedPaymentsCount: loggedPayments.length,
    logoFailed,
    month,
    monthPickerOpen,
    canAddExpenseInSelectedPeriod,
    openAddSheet: () => {
      if (!canAddExpenseInSelectedPeriod) return;
      setAddSheetOpen(true);
    },
    openMonthPicker: () => {
      setPickerYear(resolvePickerDisplayYear(month, year));
      setMonthPickerOpen(true);
    },
    paidPct,
    paidTotal,
    pickerYear,
    pickerMonths,
    selectedPickerYear,
    plannedTotal,
    refreshing,
    remainingPct,
    remainingTotal,
    retry: () => {
      setRefreshing(true);
      void load({ force: true });
    },
    routeIcon: icon,
    setAddSheetOpen,
    setLogoFailed,
    setMonthPickerOpen,
    setPickerYear,
    getPeriodOptionLabel,
    topHeaderOffset,
    updatedLabel,
    year,
    onAddComplete: (payload: AddExpenseSheetAddedPayload) => {
      setAddSheetOpen(false);

      if (payload.phase === "optimistic" && payload.expense) {
        const optimistic = payload.expense;
        const isSamePeriod = optimistic.month === month && optimistic.year === year;
        const isSamePlan = (budgetPlanId ?? null) === (optimistic.category?.budgetPlanId ?? budgetPlanId ?? null);
        if (isSamePeriod && isSamePlan && optimistic.categoryId === categoryId && !optimistic.isExtraLoggedExpense) {
          setExpenses((prev) => [optimistic, ...prev]);
        }
      }

      if (payload.phase !== "optimistic") {
        void load({ force: true });
      }
    },
    onChangeMonth: (selectedMonth: number) => {
      const actualYear = resolvePickerActualYear(selectedMonth, pickerYear);
      setMonth(selectedMonth);
      setYear(actualYear);
      navigation.setParams({ month: selectedMonth, year: actualYear });
      setMonthPickerOpen(false);
    },
    onRefresh: () => {
      setRefreshing(true);
      void load({ force: true });
    },
    onPressExpense: (item: Expense) => {
      navigation.navigate("ExpenseDetail", {
        expenseId: item.id,
        expenseName: item.name,
        categoryId,
        categoryName,
        color,
        month,
        year,
        budgetPlanId,
        currency,
        returnTo: "category-expenses",
      });
    },
  };
}