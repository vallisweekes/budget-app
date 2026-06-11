import { useFocusEffect } from "@react-navigation/native";
import { useActiveBudgetPlan } from "@/context/ActiveBudgetPlanContext";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { apiFetch, getApiMutationsSince, getApiMutationVersion, subscribeToApiMutations } from "@/lib/api";
import type { Expense } from "@/lib/apiTypes";
import { currencySymbol } from "@/lib/formatting";
import { resolveExpensePeriodRouteState } from "@/lib/helpers/expensePeriodRouteState";
import { getCachedPayPeriodExpenses, removeCachedPayPeriodExpense, setCachedPayPeriodExpenses, upsertCachedPayPeriodExpense } from "@/lib/expensePeriodCache";
import { resolveCategoryColor } from "@/lib/categoryColors";
import { useTopHeaderOffset } from "@/hooks";
import { buildPayPeriodFromMonthAnchor, formatPayPeriodLabel, normalizePayFrequency } from "@/lib/payPeriods";
import type { ExpensesStackParamList } from "@/navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMobileApiErrorMessage, useDeleteExpenseMutation } from "@/store/api";
import type { LoggedExpensesControllerState } from "@/types/LoggedExpensesScreen.types";

type Props = NativeStackScreenProps<ExpensesStackParamList, "LoggedExpenses">;

function isLoggedExpensesRelevantMutationPath(path: string): boolean {
  const normalized = path.trim().toLowerCase();
  return normalized.startsWith("/api/bff/expenses") || normalized.startsWith("/api/bff/debts/");
}

function normalizeOptionalRouteString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lowered = trimmed.toLowerCase();
  if (lowered === "null" || lowered === "undefined" || lowered === "all" || lowered === "__all__") {
    return undefined;
  }
  return trimmed;
}

function includeInLoggedList(entry: Expense, categoryId?: string): boolean {
  return (categoryId ? entry.categoryId === categoryId : true)
    && Boolean(entry.isExtraLoggedExpense);
}

export function useLoggedExpensesScreenController({ route, navigation }: Props): LoggedExpensesControllerState {
  const topHeaderOffset = useTopHeaderOffset();
  const { settings } = useBootstrapData();
  const { activeBudgetPlanId, bootstrapBudgetPlanId } = useActiveBudgetPlan();
  const nextParams = route.params ?? {};
  const today = new Date();
  const routePeriodState = resolveExpensePeriodRouteState(nextParams, { fallbackToShared: true });
  const displayedAnchor = routePeriodState.displayedAnchor;
  const categoryId = normalizeOptionalRouteString(nextParams.categoryId);
  const categoryName = typeof nextParams.categoryName === "string" ? nextParams.categoryName : "All categories";
  const color = typeof nextParams.color === "string" ? nextParams.color : null;
  const month = displayedAnchor?.month ?? (today.getMonth() + 1);
  const year = displayedAnchor?.year ?? today.getFullYear();
  const budgetPlanId = typeof nextParams.budgetPlanId === "string"
    ? nextParams.budgetPlanId
    : (activeBudgetPlanId || bootstrapBudgetPlanId || null);
  const currency = typeof nextParams.currency === "string" ? nextParams.currency : currencySymbol(settings?.currency);
  const [items, setItems] = useState<Expense[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [deleteExpense] = useDeleteExpenseMutation();
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

      const next = nextAllExpenses.filter((entry) => includeInLoggedList(entry, categoryId));
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
      void load(false);
    }, [load]),
  );

  useEffect(() => {
    const unsubscribe = subscribeToApiMutations((latestVersion) => {
      if (latestVersion === seenMutationVersionRef.current) return;

      const mutationsSince = getApiMutationsSince(seenMutationVersionRef.current);
      const hasRelevantMutation = mutationsSince.length === 0
        ? true
        : mutationsSince.some((mutation) => isLoggedExpensesRelevantMutationPath(mutation.path));

      if (!hasRelevantMutation) {
        seenMutationVersionRef.current = latestVersion;
        return;
      }

      void load(false);
    });

    return unsubscribe;
  }, [load]);

  useEffect(() => {
    const hasCache = Boolean(getCachedPayPeriodExpenses({ budgetPlanId, month, year }));
    if (!hasCache) {
      setLoading(true);
      setItems([]);
    }
    void load();
  }, [budgetPlanId, load, month, year]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const name = String(item.name ?? "").toLowerCase();
      const category = String(item.category?.name ?? "").toLowerCase();
      const source = String(item.paymentSource ?? "").replace(/_/g, " ").toLowerCase();
      return name.includes(query) || category.includes(query) || source.includes(query);
    });
  }, [items, searchQuery]);

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
  const onDeleteItem = useCallback((item: Expense) => {
    if (deletingExpenseId) return;

    Alert.alert(
      "Delete logged payment?",
      "This will remove the logged payment and reverse it from its payment source.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              const cacheParams = { budgetPlanId, month, year };
              setDeletingExpenseId(item.id);
              setError(null);
              setItems((previous) => previous.filter((entry) => entry.id !== item.id));
              removeCachedPayPeriodExpense(cacheParams, item.id);

              try {
                await deleteExpense({ id: item.id, scope: "single" }).unwrap();
                seenMutationVersionRef.current = getApiMutationVersion();
              } catch (deleteError) {
                upsertCachedPayPeriodExpense(cacheParams, item);
                setItems((previous) => {
                  if (previous.some((entry) => entry.id === item.id)) return previous;
                  return [item, ...previous];
                });
                setError(getMobileApiErrorMessage(deleteError, "Failed to delete logged payment"));
              } finally {
                setDeletingExpenseId((current) => (current === item.id ? null : current));
              }
            })();
          },
        },
      ],
    );
  }, [budgetPlanId, deleteExpense, deletingExpenseId, month, year]);

  return {
    categoryColor,
    categoryId,
    categoryName,
    color,
    currency,
    deletingExpenseId,
    error,
    items: filteredItems,
    loading,
    month,
    searchQuery,
    onDeleteItem,
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
    onSearchQueryChange: setSearchQuery,
    periodLabel,
    refreshing,
    retry: () => { void load(true); },
    screenKicker,
    topHeaderOffset,
    total,
    year,
  };
}