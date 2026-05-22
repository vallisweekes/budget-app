import { useFocusEffect } from "@react-navigation/native";
import { useActiveBudgetPlan } from "@/context/ActiveBudgetPlanContext";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { apiFetch, getApiMutationVersion } from "@/lib/api";
import type { Expense } from "@/lib/apiTypes";
import { currencySymbol } from "@/lib/formatting";
import { getCachedPayPeriodExpenses, setCachedPayPeriodExpenses } from "@/lib/expensePeriodCache";
import { resolveCategoryColor } from "@/lib/categoryColors";
import { useTopHeaderOffset } from "@/hooks";
import { buildPayPeriodFromMonthAnchor, formatPayPeriodLabel, normalizePayFrequency } from "@/lib/payPeriods";
import type { ExpensesStackParamList } from "@/navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoggedExpensesControllerState } from "@/types/LoggedExpensesScreen.types";

type Props = NativeStackScreenProps<ExpensesStackParamList, "LoggedExpenses">;

export function useLoggedExpensesScreenController({ route, navigation }: Props): LoggedExpensesControllerState {
  const topHeaderOffset = useTopHeaderOffset();
  const { settings } = useBootstrapData();
  const { activeBudgetPlanId, bootstrapBudgetPlanId } = useActiveBudgetPlan();
  const nextParams = route.params ?? {};
  const today = new Date();
  const categoryId = typeof nextParams.categoryId === "string" ? nextParams.categoryId : undefined;
  const categoryName = typeof nextParams.categoryName === "string" ? nextParams.categoryName : "All categories";
  const color = typeof nextParams.color === "string" ? nextParams.color : null;
  const month = Number.isFinite(Number(nextParams.month)) ? Math.max(1, Math.min(12, Math.floor(Number(nextParams.month)))) : (today.getMonth() + 1);
  const year = Number.isFinite(Number(nextParams.year)) ? Math.floor(Number(nextParams.year)) : today.getFullYear();
  const budgetPlanId = typeof nextParams.budgetPlanId === "string"
    ? nextParams.budgetPlanId
    : (activeBudgetPlanId || bootstrapBudgetPlanId || null);
  const currency = typeof nextParams.currency === "string" ? nextParams.currency : currencySymbol(settings?.currency);
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenMutationVersionRef = useRef<number>(getApiMutationVersion());

  const load = useCallback(async (force = false) => {
    try {
      setError(null);
      if (force) setRefreshing(true);
      else setLoading(true);

      const cached = !force ? getCachedPayPeriodExpenses({ budgetPlanId, month, year }) : null;
      const nextAllExpenses = cached ?? await (async () => {
        const qp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
        const all = await apiFetch<Expense[]>(`/api/bff/expenses?month=${month}&year=${year}&scope=pay_period${qp}`);
        const resolved = Array.isArray(all) ? all : [];
        setCachedPayPeriodExpenses({ budgetPlanId, month, year }, resolved);
        return resolved;
      })();

      const next = nextAllExpenses.filter((entry) => (
        (categoryId ? entry.categoryId === categoryId : true)
        && entry.isExtraLoggedExpense
        && entry.paymentSource !== "income"
      ));
      setItems(next);
      seenMutationVersionRef.current = getApiMutationVersion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logged expenses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [budgetPlanId, categoryId, month, year]);

  useFocusEffect(
    useCallback(() => {
      if (getApiMutationVersion() === seenMutationVersionRef.current) return;
      void load(true);
    }, [load]),
  );

  useEffect(() => {
    const hasCache = Boolean(getCachedPayPeriodExpenses({ budgetPlanId, month, year }));
    if (!hasCache) {
      setLoading(true);
      setItems([]);
    }
    void load();
  }, [budgetPlanId, load, month, year]);

  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.amount), 0), [items]);
  const payDate = Number.isFinite(settings?.payDate as number) && (settings?.payDate as number) >= 1
    ? Math.floor(settings?.payDate as number)
    : 27;
  const payFrequency = normalizePayFrequency(settings?.payFrequency);
  const payAnchorDate = payFrequency === "monthly" ? null : (settings?.payAnchorDate ?? null);
  const period = buildPayPeriodFromMonthAnchor({ year, month, payDate, payFrequency, payAnchorDate });
  const periodLabel = formatPayPeriodLabel(period.start, period.end);
  const screenKicker = categoryName ?? "All categories";
  const categoryColor = useMemo(() => resolveCategoryColor(color), [color]);

  return {
    categoryColor,
    categoryId,
    categoryName,
    color,
    currency,
    error,
    items,
    loading,
    month,
    onPressItem: (item: Expense) => {
      navigation.navigate("ExpenseDetail", {
        expenseId: item.id,
        expenseName: item.name,
        categoryId: categoryId ?? item.categoryId ?? "__none__",
        categoryName: categoryName ?? item.category?.name ?? "Uncategorised",
        color: color ?? item.category?.color ?? null,
        month,
        year,
        budgetPlanId,
        currency,
      });
    },
    onRefresh: () => { void load(true); },
    periodLabel,
    refreshing,
    retry: () => { void load(true); },
    screenKicker,
    topHeaderOffset,
    total,
    year,
  };
}