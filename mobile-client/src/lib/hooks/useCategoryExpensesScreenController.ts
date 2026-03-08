import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AddExpenseSheet from "@/components/Expenses/AddExpenseSheet";
import { apiFetch } from "@/lib/api";
import type { Category, Expense, ExpenseCategoryBreakdown, Settings } from "@/lib/apiTypes";
import { resolveCategoryColor } from "@/lib/categoryColors";
import { expenseCacheKey, getLatestPaymentAt, splitCategoryExpenses } from "@/lib/helpers/categoryExpenses";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { buildPayPeriodFromMonthAnchor, formatPayPeriodLabel, normalizePayFrequency, type PayFrequency } from "@/lib/payPeriods";
import type { ExpensesStackParamList } from "@/navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CategoryExpensesControllerState, CategoryExpensesSettingsSlice } from "@/screens/categoryExpenses/types";

type Props = NativeStackScreenProps<ExpensesStackParamList, "CategoryExpenses">;

const expensesListCache = new Map<string, Expense[]>();
const settingsSliceCache = new Map<string, CategoryExpensesSettingsSlice>();

export function useCategoryExpensesScreenController({ navigation, route }: Props): CategoryExpensesControllerState {
  const topHeaderOffset = useTopHeaderOffset();
  const {
    categoryId,
    categoryName,
    color,
    icon,
    month: routeMonth,
    year: routeYear,
    budgetPlanId,
    currency,
  } = route.params;

  const categoryColor = useMemo(() => resolveCategoryColor(color), [color]);
  const [month, setMonth] = useState(routeMonth);
  const [year, setYear] = useState(routeYear);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(routeYear);
  const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

  useEffect(() => {
    if (routeMonth !== month) setMonth(routeMonth);
    if (routeYear !== year) {
      setYear(routeYear);
      setPickerYear(routeYear);
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
      const cacheKey = expenseCacheKey(budgetPlanId, month, year);
      const settingsKey = budgetPlanId ?? "none";

      if (!force) {
        const cachedAll = expensesListCache.get(cacheKey);
        const cachedSettings = settingsSliceCache.get(settingsKey);
        if (cachedAll && cachedSettings) {
          const split = splitCategoryExpenses(cachedAll, categoryId);
          setExpenses(split.main);
          setLoggedPayments(split.logged);
          setPayDate(cachedSettings.payDate);
          setPayFrequency(cachedSettings.payFrequency);
          setLogoFailed({});
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
      const [all, appSettings] = await Promise.all([
        apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}&scope=pay_period&refreshLogos=1${qp}`),
        apiFetch<Settings>("/api/bff/settings"),
      ]);

      const allExpenses = Array.isArray(all) ? all : [];
      expensesListCache.set(cacheKey, allExpenses);

      const settingsSlice = {
        payDate: appSettings?.payDate ?? null,
        payFrequency: normalizePayFrequency(appSettings?.payFrequency),
      } satisfies CategoryExpensesSettingsSlice;
      settingsSliceCache.set(settingsKey, settingsSlice);

      const split = splitCategoryExpenses(allExpenses, categoryId);
      setExpenses(split.main);
      setLoggedPayments(split.logged);
      setPayDate(settingsSlice.payDate);
      setPayFrequency(settingsSlice.payFrequency);
      setLogoFailed({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, categoryId, month, year]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const cacheKey = expenseCacheKey(budgetPlanId, month, year);
    const settingsKey = budgetPlanId ?? "none";
    const hasCache = expensesListCache.has(cacheKey) && settingsSliceCache.has(settingsKey);
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

  return {
    addSheetOpen,
    budgetPlanId,
    categoriesForAddSheet,
    categoryColor,
    categoryId,
    categoryName,
    color,
    currency,
    error,
    expenses,
    heroPeriodLabel,
    loading,
    loggedPaymentsCount: loggedPayments.length,
    logoFailed,
    month,
    monthPickerOpen,
    openAddSheet: () => setAddSheetOpen(true),
    openMonthPicker: () => {
      setPickerYear(year);
      setMonthPickerOpen(true);
    },
    paidPct,
    paidTotal,
    pickerYear,
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
    shortMonths,
    topHeaderOffset,
    updatedLabel,
    year,
    onAddComplete: () => {
      setAddSheetOpen(false);
      void load({ force: true });
    },
    onChangeMonth: (selectedMonth: number) => {
      setMonth(selectedMonth);
      setYear(pickerYear);
      navigation.setParams({ month: selectedMonth, year: pickerYear });
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
      });
    },
  };
}