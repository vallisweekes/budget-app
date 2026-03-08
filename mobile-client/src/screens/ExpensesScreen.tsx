/**
 * ExpensesScreen
 *
 * All financial calculations (totals, paid/unpaid, category breakdown) are
 * computed server-side via /api/bff/expenses/summary so this screen shares
 * the exact same logic as the web client — no client-side arithmetic.
 *
 * Currency comes from /api/bff/settings (never hardcoded).
 * Upcoming payments come from /api/bff/expense-insights.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  ScrollView,
  PanResponder,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect, useRoute, useScrollToTop, type RouteProp } from "@react-navigation/native";

import { apiFetch } from "@/lib/api";
import type {
  ExpenseSummary,
  ExpenseCategoryBreakdown,
  BudgetPlansResponse,
  BudgetPlanListItem,
  ExpenseMonthsResponse,
  ExpensePayPeriodMonthsResponse,
  ExpenseInsights,
  Expense,
} from "@/lib/apiTypes";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { currencySymbol, fmt } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { useYearGuard } from "@/lib/hooks/useYearGuard";
import { buildPayPeriodFromMonthAnchor, getPayPeriodAnchorFromWindow, normalizePayFrequency, resolveActivePayPeriod } from "@/lib/payPeriods";
import { T } from "@/lib/theme";
import type { ExpensesStackParamList } from "@/navigation/types";
import CategoryBreakdown from "@/components/Expenses/CategoryBreakdown";
import AddExpenseSheet from "@/components/Expenses/AddExpenseSheet";

/* ════════════════════════════════════════════════════════════════
 * Screen
 * ════════════════════════════════════════════════════════════════ */

type Props = NativeStackScreenProps<ExpensesStackParamList, "ExpensesList">;
type ScreenRoute = RouteProp<ExpensesStackParamList, "ExpensesList">;

export default function ExpensesScreen({ navigation }: Props) {
  const listRef = useRef<FlatList<never>>(null);
  useScrollToTop(listRef);
  const route = useRoute<ScreenRoute>();
  const topHeaderOffset = useTopHeaderOffset();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const hasSyncedRouteParamsRef = useRef(false);

  const {
    settings,
    isLoading: bootstrapLoading,
    error: bootstrapError,
    ensureLoaded,
    refresh: refreshBootstrap,
  } = useBootstrapData();

  const [plans, setPlans] = useState<BudgetPlanListItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [expenseMonths, setExpenseMonths] = useState<ExpenseMonthsResponse["months"]>([]);
  const [periodCountsByMonth, setPeriodCountsByMonth] = useState<Record<number, number>>({});
  const skipFirstFocusReloadRef = useRef(true);
  const skipNextTabFocusReloadRef = useRef(false);
  const plansRef = useRef<BudgetPlanListItem[]>([]);
  const summaryCacheRef = useRef<Record<string, Record<number, Record<number, ExpenseSummary>>>>({});
  const monthsCacheRef = useRef<Record<string, ExpenseMonthsResponse["months"]>>({});
  const cacheSignatureRef = useRef<string | null>(null);

  const [summary, setSummary]   = useState<ExpenseSummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<ExpenseSummary | null>(null);
  const [loggedExpensesCount, setLoggedExpensesCount] = useState(0);

  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [addSheetOpen, setAddSheetOpen] = useState(false);

  // Month picker modal
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const openMonthPicker = () => { setPickerYear(year); setMonthPickerOpen(true); };

  const currency = currencySymbol(settings?.currency);
  const { canDecrement } = useYearGuard(settings);

  useEffect(() => {
    const tabNavigation = navigation.getParent();
    if (!tabNavigation) return;

    const unsubscribe = tabNavigation.addListener("blur", () => {
      skipNextTabFocusReloadRef.current = true;
      const current = new Date();
      const nextMonth = current.getMonth() + 1;
      const nextYear = current.getFullYear();
      setMonth((prev) => (prev === nextMonth ? prev : nextMonth));
      setYear((prev) => (prev === nextYear ? prev : nextYear));
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const routeMonth = Number(route.params?.month);
    const routeYear = Number(route.params?.year);

    // Ignore the first pass to avoid restoring stale persisted tab params
    // (causes first-open blank until tab blur/focus cycle).
    if (!hasSyncedRouteParamsRef.current) {
      hasSyncedRouteParamsRef.current = true;
      return;
    }

    if (Number.isFinite(routeMonth) && routeMonth >= 1 && routeMonth <= 12) {
      setMonth(routeMonth);
    }
    if (Number.isFinite(routeYear)) {
      setYear(routeYear);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.month, route.params?.year]);

  useEffect(() => {
    const prevDisabled = !canDecrement(year, month);
    const paramsMonth = Number(route.params?.month);
    const paramsYear = Number(route.params?.year);
    const paramsPrevDisabled = typeof route.params?.prevDisabled === "boolean" ? route.params.prevDisabled : undefined;

    const monthChanged = !(Number.isFinite(paramsMonth) && paramsMonth === month);
    const yearChanged = !(Number.isFinite(paramsYear) && paramsYear === year);
    const disabledChanged = paramsPrevDisabled !== prevDisabled;

    if (!monthChanged && !yearChanged && !disabledChanged) return;

    navigation.setParams({
      month,
      year,
      prevDisabled,
    });
  }, [canDecrement, month, navigation, route.params?.month, route.params?.prevDisabled, route.params?.year, year]);

  const personalPlanId = plans.find((p) => p.kind === "personal")?.id ?? null;
  const activePlanId = selectedPlanId ?? personalPlanId;
  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;
  const isPersonalPlan = !activePlan || activePlan.kind === "personal";
  const isAdditionalPlan = !isPersonalPlan && plans.length > 1;

  useEffect(() => {
    const paramsBudgetPlanId = typeof route.params?.budgetPlanId === "string" ? route.params.budgetPlanId : null;
    const paramsCurrency = typeof route.params?.currency === "string" ? route.params.currency : undefined;
    const paramsLoggedExpensesCount = Number(route.params?.loggedExpensesCount);
    const planChanged = paramsBudgetPlanId !== activePlanId;
    const currencyChanged = paramsCurrency !== currency;
    const loggedCountChanged = !(Number.isFinite(paramsLoggedExpensesCount) && paramsLoggedExpensesCount === loggedExpensesCount);

    if (!planChanged && !currencyChanged && !loggedCountChanged) return;

    navigation.setParams({
      budgetPlanId: activePlanId,
      currency,
      loggedExpensesCount,
    });
  }, [activePlanId, currency, loggedExpensesCount, navigation, route.params?.budgetPlanId, route.params?.currency, route.params?.loggedExpensesCount]);

  const planTotalAmount = expenseMonths.reduce((sum, m) => sum + (m.totalAmount ?? 0), 0);
  const planTotalCount = expenseMonths.reduce((sum, m) => sum + (m.totalCount ?? 0), 0);

  const prevIsPersonalPlanRef = useRef<boolean>(true);

  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  // Plan tabs: keep selected pill centered when horizontally scrollable.
  const planScrollRef = useRef<ScrollView>(null);
  const planViewportWidthRef = useRef(0);
  const planItemLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});

  const activePlanIndex = Math.max(0, plans.findIndex((p) => p.id === activePlanId));
  const setPlanByIndex = (idx: number) => {
    if (!plans.length) return;
    const clamped = Math.max(0, Math.min(plans.length - 1, idx));
    const next = plans[clamped];
    if (next?.id) setSelectedPlanId(next.id);
  };

  const planSwipe = PanResponder.create({
    onMoveShouldSetPanResponder: (_evt, g) => {
      // Only capture clear horizontal swipes
      return Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
    },
    onPanResponderRelease: (_evt, g) => {
      if (Math.abs(g.dx) < 60) return;
      if (g.dx < 0) setPlanByIndex(activePlanIndex + 1);
      else setPlanByIndex(activePlanIndex - 1);
    },
  });

  const scrollPlanIntoView = useCallback(() => {
    const selectedId = (activePlanId ?? personalPlanId) ?? null;
    if (!selectedId) return;
    const viewportWidth = planViewportWidthRef.current;
    if (!viewportWidth) return;
    const layout = planItemLayoutsRef.current[selectedId];
    if (!layout) return;
    const targetX = Math.max(0, layout.x + layout.width / 2 - viewportWidth / 2);
    planScrollRef.current?.scrollTo({ x: targetX, animated: true });
  }, [activePlanId, personalPlanId]);

  useEffect(() => {
    if (plans.length <= 1) return;
    requestAnimationFrame(scrollPlanIntoView);
  }, [plans.length, activePlanId, personalPlanId, scrollPlanIntoView]);

  const monthName = (m: number) => {
    const names = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return names[Math.max(1, Math.min(12, m)) - 1] ?? "";
  };

  const parsePlanCreatedAt = useCallback((value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const latestResolvedDate = useCallback((...dates: Array<Date | null | undefined>) => {
    const valid = dates.filter((date): date is Date => Boolean(date && !Number.isNaN(date.getTime())));
    if (valid.length === 0) return null;
    return valid.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
  }, []);

  const periodSpanLabel = (m: number) => {
    const safeMonth = Math.max(1, Math.min(12, m));
    const start = SHORT_MONTHS[(safeMonth + 10) % 12];
    const end = SHORT_MONTHS[(safeMonth + 11) % 12];
    return `${start} - ${end}`;
  };

  const clearExpenseCaches = useCallback(() => {
    summaryCacheRef.current = {};
    monthsCacheRef.current = {};
    setLoadedKey(null);
  }, []);

  const effectivePayDate = Number.isFinite(settings?.payDate as number) && (settings?.payDate as number) >= 1
    ? Math.floor(settings?.payDate as number)
    : 27;
  const effectivePayFrequency = normalizePayFrequency(settings?.payFrequency);
  const setupCompletedAt = useMemo(
    () => parsePlanCreatedAt(settings?.setupCompletedAt ?? settings?.accountCreatedAt),
    [parsePlanCreatedAt, settings?.accountCreatedAt, settings?.setupCompletedAt]
  );
  const activePlanCreatedAt = useMemo(
    () => latestResolvedDate(parsePlanCreatedAt(activePlan?.createdAt), setupCompletedAt),
    [activePlan?.createdAt, latestResolvedDate, parsePlanCreatedAt, setupCompletedAt]
  );
  const defaultActivePeriod = useMemo(
    () => resolveActivePayPeriod({
      now: new Date(),
      payDate: effectivePayDate,
      payFrequency: effectivePayFrequency,
      planCreatedAt: activePlanCreatedAt,
    }),
    [activePlanCreatedAt, effectivePayDate, effectivePayFrequency]
  );
  const defaultActiveAnchor = useMemo(
    () => getPayPeriodAnchorFromWindow({ period: defaultActivePeriod, payFrequency: effectivePayFrequency }),
    [defaultActivePeriod, effectivePayFrequency]
  );
  const defaultActiveMonth = defaultActiveAnchor.month;
  const defaultActiveYear = defaultActiveAnchor.year;

  useEffect(() => {
    const wasPersonal = prevIsPersonalPlanRef.current;
    if (!wasPersonal && isPersonalPlan) {
      setMonth(defaultActiveMonth);
      setYear(defaultActiveYear);
    }
    prevIsPersonalPlanRef.current = isPersonalPlan;
  }, [defaultActiveMonth, defaultActiveYear, isPersonalPlan]);

  useEffect(() => {
    const tabNavigation = navigation.getParent();
    if (!tabNavigation) return;

    const unsubscribe = tabNavigation.addListener("blur", () => {
      setMonth((prev) => (prev === defaultActiveMonth ? prev : defaultActiveMonth));
      setYear((prev) => (prev === defaultActiveYear ? prev : defaultActiveYear));
    });

    return unsubscribe;
  }, [defaultActiveMonth, defaultActiveYear, navigation]);

  const planCacheKey = useCallback((planId: string | null | undefined) => planId ?? "none", []);

  const getCachedSummary = useCallback((planId: string | null | undefined, targetYear: number, targetMonth: number) => {
    const key = planCacheKey(planId);
    return summaryCacheRef.current[key]?.[targetYear]?.[targetMonth] ?? null;
  }, [planCacheKey]);

  const setCachedSummary = useCallback((planId: string | null | undefined, targetYear: number, targetMonth: number, value: ExpenseSummary) => {
    const key = planCacheKey(planId);
    if (!summaryCacheRef.current[key]) summaryCacheRef.current[key] = {};
    if (!summaryCacheRef.current[key][targetYear]) summaryCacheRef.current[key][targetYear] = {};
    summaryCacheRef.current[key][targetYear][targetMonth] = value;
  }, [planCacheKey]);

  const getOrFetchSummary = useCallback(async (params: {
    planId: string | null;
    month: number;
    year: number;
    force?: boolean;
  }): Promise<ExpenseSummary> => {
    const { planId, month: targetMonth, year: targetYear, force = false } = params;
    if (!force) {
      const cached = getCachedSummary(planId, targetYear, targetMonth);
      if (cached) return cached;
    }

    const planQp = planId ? `&budgetPlanId=${encodeURIComponent(planId)}` : "";
    const fresh = await apiFetch<ExpenseSummary>(
      `/api/bff/expenses/summary?month=${targetMonth}&year=${targetYear}&scope=pay_period${planQp}`,
      { cacheTtlMs: 0 }
    );
    setCachedSummary(planId, targetYear, targetMonth, fresh);
    return fresh;
  }, [getCachedSummary, setCachedSummary]);

  const fetchPayPeriodMonths = useCallback(async (targetYear: number, planId: string | null) => {
    const planQp = planId ? `&budgetPlanId=${encodeURIComponent(planId)}` : "";
    return apiFetch<ExpensePayPeriodMonthsResponse>(
      `/api/bff/expenses/pay-period-months?year=${targetYear}${planQp}`,
      { cacheTtlMs: 0 }
    );
  }, []);

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    try {
      setError(null);
      const [bootstrapResult, bp] = await Promise.all([
        force ? refreshBootstrap({ force: true }) : ensureLoaded(),
        !force && plansRef.current.length > 0
          ? Promise.resolve<BudgetPlansResponse>({ plans: plansRef.current })
          : apiFetch<BudgetPlansResponse>("/api/bff/budget-plans", { cacheTtlMs: force ? 0 : 6_000 }),
      ]);

      const s = bootstrapResult.settings;

      if (!s) {
        throw bootstrapError ?? new Error("Failed to load settings");
      }

      const payDateForResolution = Number.isFinite(s?.payDate as number) && (s?.payDate as number) >= 1
        ? Math.floor(s.payDate as number)
        : 27;
      const payFrequencyForResolution = normalizePayFrequency(s?.payFrequency);
      const nextSignature = `${payDateForResolution}:${payFrequencyForResolution}`;
      if (cacheSignatureRef.current !== nextSignature) {
        cacheSignatureRef.current = nextSignature;
        summaryCacheRef.current = {};
        setLoadedKey(null);
      }

      const rawPlans = Array.isArray(bp?.plans) ? bp.plans : [];
      const nextPlans = rawPlans.slice().sort((a, b) => {
        const aPersonal = a.kind === "personal";
        const bPersonal = b.kind === "personal";
        if (aPersonal && !bPersonal) return -1;
        if (!aPersonal && bPersonal) return 1;
        // Keep stable-ish ordering for additional plans
        const aCreated = new Date(a.createdAt).getTime();
        const bCreated = new Date(b.createdAt).getTime();
        return aCreated - bCreated;
      });
      setPlans((prev) => {
        if (
          prev.length === nextPlans.length
          && prev.every((plan, index) => (
            plan.id === nextPlans[index]?.id
            && plan.kind === nextPlans[index]?.kind
            && plan.createdAt === nextPlans[index]?.createdAt
          ))
        ) {
          return prev;
        }
        return nextPlans;
      });

      const resolvedPlanId = activePlanId
        ?? nextPlans.find((p) => p.kind === "personal")?.id
        ?? nextPlans[0]?.id
        ?? null;

      const resolvedPlanCreatedAt = latestResolvedDate(
        parsePlanCreatedAt(nextPlans.find((plan) => plan.id === resolvedPlanId)?.createdAt),
        setupCompletedAt
      );
      const resolvedActivePeriod = resolveActivePayPeriod({
        now: new Date(),
        payDate: payDateForResolution,
        payFrequency: payFrequencyForResolution,
        planCreatedAt: resolvedPlanCreatedAt,
      });
      const resolvedDefaultAnchor = getPayPeriodAnchorFromWindow({
        period: resolvedActivePeriod,
        payFrequency: payFrequencyForResolution,
      });
      const resolvedDefaultMonth = resolvedDefaultAnchor.month;
      const resolvedDefaultYear = resolvedDefaultAnchor.year;
      const routeMonth = Number(route.params?.month);
      const routeYear = Number(route.params?.year);
      const hasRouteMonth = Number.isFinite(routeMonth) && routeMonth >= 1 && routeMonth <= 12;
      const hasRouteYear = Number.isFinite(routeYear) && routeYear >= 1900;
      const currentCalendarMonth = new Date().getMonth() + 1;
      const currentCalendarYear = new Date().getFullYear();
      const routeLooksLikeRawCalendarDefault = hasRouteMonth
        && hasRouteYear
        && routeMonth === currentCalendarMonth
        && routeYear === currentCalendarYear;
      const shouldUseResolvedDefaultPeriod = (!hasRouteMonth
        && !hasRouteYear
        || routeLooksLikeRawCalendarDefault)
        && month === currentCalendarMonth
        && year === currentCalendarYear;

      // Load distinct expense months early so we can choose the best initial period
      // before rendering an empty state (prevents a £0/0 bills flash).
      let months: ExpenseMonthsResponse["months"] = [];
      if (resolvedPlanId) {
        const monthsKey = planCacheKey(resolvedPlanId);
        if (!force && monthsCacheRef.current[monthsKey]) {
          months = [...monthsCacheRef.current[monthsKey]];
        } else {
          const qp = `budgetPlanId=${encodeURIComponent(resolvedPlanId)}`;
          const monthsData = await apiFetch<ExpenseMonthsResponse>(`/api/bff/expenses/months?${qp}`, { cacheTtlMs: 0 });
          months = Array.isArray(monthsData?.months) ? monthsData.months : [];
          monthsCacheRef.current[monthsKey] = months;
        }
        // chronological order (earliest → latest)
        months.sort((a, b) => (a.year - b.year) || (a.month - b.month));
        setExpenseMonths(months);
      } else {
        setExpenseMonths([]);
      }

      // 1) Load the current pay-period summary for the selected plan.
      // NOTE: /expenses/months groups by the expense's stored month/year (due-date month),
      // which can differ from pay-period anchor months, so we do NOT use it to choose
      // a pay-period window.
      const initialMonth = shouldUseResolvedDefaultPeriod ? resolvedDefaultMonth : month;
      const initialYear = shouldUseResolvedDefaultPeriod ? resolvedDefaultYear : year;
      const initialPrevMonth = initialMonth === 1 ? 12 : initialMonth - 1;
      const initialPrevYear = initialMonth === 1 ? initialYear - 1 : initialYear;

      let [sumData, prevData] = await Promise.all([
        getOrFetchSummary({ planId: resolvedPlanId, month: initialMonth, year: initialYear, force }),
        getOrFetchSummary({ planId: resolvedPlanId, month: initialPrevMonth, year: initialPrevYear, force }),
      ]);

      let targetMonth = initialMonth;
      let targetYear = initialYear;

      // 2) If the current pay period is empty but we have upcoming payments (like on Home),
      // jump straight to the pay-period that contains the earliest upcoming due date.
      if ((Number(sumData?.totalCount ?? 0) <= 0) && resolvedPlanId) {
        try {
          const qp = `budgetPlanId=${encodeURIComponent(resolvedPlanId)}`;
          const insights = await apiFetch<ExpenseInsights>(`/api/bff/expense-insights?${qp}`, { cacheTtlMs: 0 });
          const upcoming = Array.isArray(insights?.upcoming) ? insights.upcoming : [];
          const nextDue = upcoming
            .map((u) => (u?.dueDate ? new Date(u.dueDate) : null))
            .filter((d): d is Date => Boolean(d && !Number.isNaN(d.getTime())))
            .sort((a, b) => a.getTime() - b.getTime())[0];

          if (nextDue) {
            const period = resolveActivePayPeriod({
              now: nextDue,
              payDate: payDateForResolution,
              payFrequency: payFrequencyForResolution,
              planCreatedAt: resolvedPlanCreatedAt,
            });
            const anchor = getPayPeriodAnchorFromWindow({
              period,
              payFrequency: payFrequencyForResolution,
            });
            const suggestedMonth = anchor.month;
            const suggestedYear = anchor.year;

            if (suggestedMonth !== initialMonth || suggestedYear !== initialYear) {
              targetMonth = suggestedMonth;
              targetYear = suggestedYear;
              const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
              const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
              [sumData, prevData] = await Promise.all([
                getOrFetchSummary({ planId: resolvedPlanId, month: targetMonth, year: targetYear, force }),
                getOrFetchSummary({ planId: resolvedPlanId, month: prevMonth, year: prevYear, force }),
              ]);
            }
          }
        } catch {
          // Best-effort only; fall back to the initial period.
        }
      }

      const expensesPlanQp = resolvedPlanId ? `&budgetPlanId=${encodeURIComponent(resolvedPlanId)}` : "";
      const payPeriodExpenses = await apiFetch<Expense[]>(
        `/api/bff/expenses?month=${targetMonth}&year=${targetYear}&scope=pay_period${expensesPlanQp}`,
        { cacheTtlMs: 0 }
      );
      const nextLoggedExpensesCount = (Array.isArray(payPeriodExpenses) ? payPeriodExpenses : []).filter((entry) => (
        entry.isExtraLoggedExpense && entry.paymentSource !== "income"
      )).length;

      setSummary(sumData);
      setPreviousSummary(prevData);
      setLoggedExpensesCount(nextLoggedExpensesCount);

      if (targetMonth !== month) setMonth(targetMonth);
      if (targetYear !== year) setYear(targetYear);

      setLoadedKey(`${resolvedPlanId ?? "none"}:${targetYear}-${targetMonth}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activePlanId, bootstrapError, ensureLoaded, getOrFetchSummary, latestResolvedDate, month, planCacheKey, refreshBootstrap, selectedPlanId, setupCompletedAt, year]);

  const currentViewKey = `${activePlanId ?? "none"}:${year}-${month}`;
  useEffect(() => {
    // Avoid redundant fetches when we update month/year inside `load()`.
    if (loadedKey && loadedKey === currentViewKey && summary) return;
    const hasCachedCurrent = Boolean(getCachedSummary(activePlanId, year, month));
    if (!hasCachedCurrent) setLoading(true);
    void load();
  }, [activePlanId, currentViewKey, getCachedSummary, load, loadedKey, month, summary, year]);

  // Refresh when navigating back from CategoryExpensesScreen
  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocusReloadRef.current) {
        skipFirstFocusReloadRef.current = false;
        return;
      }
      if (skipNextTabFocusReloadRef.current) {
        skipNextTabFocusReloadRef.current = false;
        return;
      }
      void load();
    }, [load])
  );

  const changeMonth = (delta: number) => {
    if (delta < 0 && !canDecrement(year, month)) return;
    let m = month + delta, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m); setYear(y);
  };

  const handleCategoryPress = (cat: ExpenseCategoryBreakdown) => {
    navigation.navigate("CategoryExpenses", {
      categoryId: cat.categoryId,
      categoryName: cat.name,
      color: cat.color,
      icon: cat.icon,
      month,
      year,
      budgetPlanId: activePlanId,
      currency,
    });
  };

  const showTopAddExpenseCta = !loading && !error && (summary?.totalCount ?? 0) === 0;

  const showPlanTotalFallback =
    isAdditionalPlan &&
    (summary?.totalCount ?? 0) === 0 &&
    expenseMonths.length > 0 &&
    planTotalAmount > 0;

  const accountCreatedAt = useMemo(() => {
    if (!settings?.accountCreatedAt) return null;
    const parsed = new Date(settings.accountCreatedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }, [settings?.accountCreatedAt]);

  const periodEndFor = useCallback((targetYear: number, targetMonth: number) => {
    const period = buildPayPeriodFromMonthAnchor({
      year: targetYear,
      month: targetMonth,
      payDate: effectivePayDate,
      payFrequency: effectivePayFrequency,
    });
    const periodEnd = new Date(period.end.getTime());
    periodEnd.setHours(23, 59, 59, 999);
    return periodEnd;
  }, [effectivePayDate, effectivePayFrequency]);

  useEffect(() => {
    if (!monthPickerOpen) return;
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetchPayPeriodMonths(pickerYear, activePlanId);
        if (cancelled) return;
        const next: Record<number, number> = {};
        for (const row of Array.isArray(response?.months) ? response.months : []) {
          next[row.month] = Number(row.totalCount ?? 0);
        }
        setPeriodCountsByMonth(next);
      } catch {
        if (cancelled) return;
        setPeriodCountsByMonth({});
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activePlanId, fetchPayPeriodMonths, monthPickerOpen, pickerYear, refreshing]);

  const enabledPeriodMonths = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => {
        const hasData = (periodCountsByMonth[m] ?? 0) > 0;
        if (!hasData) return false;
        if (!accountCreatedAt) return true;
        return periodEndFor(pickerYear, m).getTime() >= accountCreatedAt.getTime();
      }),
    [accountCreatedAt, periodCountsByMonth, periodEndFor, pickerYear]
  );

  const enabledPeriodSet = useMemo(
    () => new Set(enabledPeriodMonths),
    [enabledPeriodMonths]
  );

  const allPeriodMonths = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const selectedPeriodRange = summary?.periodRangeLabel?.trim() || `${monthName(month)} ${year}`;
  const loadingUi = loading || bootstrapLoading;

  return (
		<SafeAreaView style={styles.safe} edges={[]}>
      {loadingUi ? (
        <View style={[styles.center, { paddingTop: topHeaderOffset }]}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : error ? (
        <View style={[styles.center, { paddingTop: topHeaderOffset }]}>
          <Ionicons name="cloud-offline-outline" size={40} color={T.textDim} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => { void load(); }} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={[]}
          keyExtractor={() => ""}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                clearExpenseCaches();
                setRefreshing(true);
                void load({ force: true });
              }}
              tintColor={T.accent}
            />
          }
          ListHeaderComponent={
            <>
              {/* ── Purple hero banner ── */}
              <View style={[styles.purpleHero, { paddingTop: topHeaderOffset + 22 }]}>
                {showPlanTotalFallback ? (
                  <Text style={styles.purpleHeroLabel}>
                    Total {activePlan?.name ?? "Plan"} expenses
                  </Text>
                ) : (
                  <Pressable onPress={openMonthPicker} style={styles.purpleHeroLabelBtn} hitSlop={12}>
                    <Text style={styles.purpleHeroLabel}>
                      {selectedPeriodRange}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.72)" />
                  </Pressable>
                )}
                {summary ? (
                  <>
                    <Text style={styles.purpleHeroAmount}>
                      {fmt(showPlanTotalFallback ? planTotalAmount : (summary.totalAmount ?? 0), currency)}
                    </Text>
                    {!showPlanTotalFallback && (
                      <Text style={styles.purpleHeroMeta}>
                        {`${summary.totalCount ?? 0} bill${(summary.totalCount ?? 0) === 1 ? "" : "s"}`}
                      </Text>
                    )}
                    {(() => {
                      if (showPlanTotalFallback) return null;
                      const currentTotal = summary.totalAmount ?? 0;
                      const prevTotal = previousSummary?.totalAmount ?? 0;
                      if (prevTotal <= 0) return null;
                      const changePct = ((currentTotal - prevTotal) / prevTotal) * 100;
                      const up = changePct >= 0;
                      const pctLabel = `${up ? "↗" : "↘"} ${Math.abs(changePct).toFixed(1)}%`;
                      return (
                        <View style={styles.purpleHeroDeltaRow}>
                          <Text style={[styles.purpleHeroDeltaPct, up ? styles.purpleDeltaUp : styles.purpleDeltaDown]}>
                            {pctLabel}
                          </Text>
                          <Text style={styles.purpleHeroDeltaText}> vs last month</Text>
                        </View>
                      );
                    })()}
                  </>
                ) : null}
              </View>

              {showTopAddExpenseCta && isPersonalPlan ? (
                <View style={styles.noExpensesCard}>
                  <View style={styles.noExpensesCardRow}>
                    <View style={styles.noExpensesCardCopy}>
                      <Text style={styles.noExpensesTitle}>No expense for this period</Text>
                      <Text style={styles.noExpensesSub}>{selectedPeriodRange}</Text>
                      <Text style={styles.noExpensesHint}>Tap + Expense to create your first expense.</Text>
                    </View>
                    <Pressable onPress={() => setAddSheetOpen(true)} style={styles.noExpensesAddBtn}>
                      <Ionicons name="add" size={18} color={T.onAccent} />
                      <Text style={styles.noExpensesAddBtnTxt}>Expense</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {plans.length > 1 && (
                <View style={styles.planCardsWrap} {...planSwipe.panHandlers}>
					<View style={styles.planTabsBg}>
						<ScrollView
              ref={planScrollRef}
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.planTabsScroll}
              onLayout={(e) => {
                planViewportWidthRef.current = e.nativeEvent.layout.width;
              }}
						>
							{plans.map((p) => {
								const selected = (activePlanId ?? personalPlanId) === p.id;
								return (
									<Pressable
										key={p.id}
										onPress={() => setSelectedPlanId(p.id)}
                    onLayout={(e) => {
                      planItemLayoutsRef.current[p.id] = {
                        x: e.nativeEvent.layout.x,
                        width: e.nativeEvent.layout.width,
                      };
                      if (selected) requestAnimationFrame(scrollPlanIntoView);
                    }}
										style={[styles.planPill, selected && styles.planPillSelected]}
										hitSlop={8}
									>
										<Text style={[styles.planPillText, selected && styles.planPillTextSelected]} numberOfLines={1}>
											{p.name}
										</Text>
									</Pressable>
								);
							})}
						</ScrollView>
					</View>
                </View>
              )}

              {!isPersonalPlan && plans.length > 1 && (summary?.totalCount ?? 0) === 0 && (
                <View style={styles.noExpensesCard}>
                  <View style={styles.noExpensesCardRow}>
                    <View style={styles.noExpensesCardCopy}>
                      <Text style={styles.noExpensesTitle}>No expense for this period</Text>
                      <Text style={styles.noExpensesSub}>
                        {selectedPeriodRange}
                      </Text>
                      <Text style={styles.noExpensesHint}>Tap + Expense to create your first expense.</Text>
                    </View>
                    <Pressable onPress={() => setAddSheetOpen(true)} style={styles.noExpensesAddBtn}>
                      <Ionicons name="add" size={18} color={T.onAccent} />
                      <Text style={styles.noExpensesAddBtnTxt}>Expense</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {summary && (
                <CategoryBreakdown
                  categories={summary.categoryBreakdown}
                  currency={currency}
                  fmt={fmt}
                  onCategoryPress={handleCategoryPress}
                  onAddPress={() => setAddSheetOpen(true)}
                />
              )}

              {!isPersonalPlan && plans.length > 1 && expenseMonths.length > 0 && (
                <>
                  <View style={styles.sectionHeadingWrap}>
                    <Text style={styles.sectionHeading}>Upcoming Months Expenses</Text>
                  </View>
                  <View style={styles.monthCardsWrap}>
                    {expenseMonths
                      .filter((m) => !(m.month === month && m.year === year))
                      .map((m) => {
                      return (
                        <Pressable
                          key={`${m.year}-${m.month}`}
                          onPress={() => {
                            setMonth(m.month);
                            setYear(m.year);
                          }}
                          style={styles.monthCard}
                        >
                          <View style={styles.monthCardRow}>
                            <Text style={styles.monthCardTitle}>{monthName(m.month)} {m.year}</Text>
                            <Text style={styles.monthCardAmount}>{fmt(m.totalAmount ?? 0, currency)}</Text>
                          </View>
                          <Text style={styles.monthCardMeta}>{m.totalCount} expense{m.totalCount === 1 ? "" : "s"}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          }
          renderItem={() => null}
        />
      )}

      <AddExpenseSheet
        visible={addSheetOpen}
        month={month}
        year={year}
        budgetPlanId={activePlanId}
        plans={plans}
        currency={currency}
        categories={summary?.categoryBreakdown ?? []}
        onAdded={() => {
          clearExpenseCaches();
          setAddSheetOpen(false);
          setRefreshing(true);
          void load({ force: true });
        }}
        onClose={() => setAddSheetOpen(false)}
      />

      {/* Month Picker Modal */}
      <Modal
        visible={monthPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setMonthPickerOpen(false)} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            {/* Year navigator */}
            <View style={styles.pickerYearRow}>
              <Pressable
                onPress={() => setPickerYear((y) => y - 1)}
                hitSlop={12}
                style={styles.pickerYearBtn}
              >
                <Ionicons name="chevron-back" size={22} color={T.text} />
              </Pressable>
              <Text style={styles.pickerYearText}>{pickerYear}</Text>
              <Pressable
                onPress={() => setPickerYear((y) => y + 1)}
                hitSlop={12}
                style={styles.pickerYearBtn}
              >
                <Ionicons name="chevron-forward" size={22} color={T.text} />
              </Pressable>
            </View>
            {/* Month grid */}
            <View style={styles.pickerGrid}>
              {allPeriodMonths.map((m) => {
                const isEnabled = enabledPeriodSet.has(m);
                const isSelected = m === month && pickerYear === year;
                return (
                  <Pressable
                    key={m}
                    disabled={!isEnabled}
                    onPress={() => {
                      if (!isEnabled) return;
                      setMonth(m);
                      setYear(pickerYear);
                      setMonthPickerOpen(false);
                    }}
                    style={[
                      styles.pickerCell,
                      !isEnabled && styles.pickerCellDisabled,
                      isSelected && styles.pickerCellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerCellText,
                        !isEnabled && styles.pickerCellDisabledText,
                        isSelected && styles.pickerCellSelectedText,
                      ]}
                    >
                      {periodSpanLabel(m)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scrollContent: { paddingBottom: 140 },
  errorText: { color: "#e25c5c", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },

  actionCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  actionCopy: { flex: 1 },
  actionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  actionText: { marginTop: 2, color: T.textDim, fontSize: 12, fontWeight: "700" },
  actionBtn: {
    minWidth: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: T.accent,
  },
  actionBtnText: { color: T.onAccent, fontSize: 13, fontWeight: "800" },

  planCardsWrap: {
    marginTop: 32,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  planTabsBg: {
    borderRadius: 999,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    padding: 4,
    overflow: "hidden",
  },
  planTabsScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 6,
    gap: 8,
  },
  planPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  planPillSelected: {
    backgroundColor: T.accentDim,
  },
  planPillText: {
    color: T.textDim,
    fontWeight: "800",
    fontSize: 14,
  },
  planPillTextSelected: {
    color: T.text,
  },

  noExpensesCard: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: T.accentBorder,
  },
  noExpensesCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  noExpensesCardCopy: { flex: 1 },
  noExpensesAddBtn: {
    height: 36,
    borderRadius: 18,
    backgroundColor: T.accent,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  noExpensesAddBtnTxt: {
    color: T.onAccent,
    fontSize: 13,
    fontWeight: "800",
  },
  noExpensesTitle: {
    color: T.text,
    fontWeight: "900",
    fontSize: 14,
  },
  noExpensesSub: {
    marginTop: 4,
    color: T.textDim,
    fontWeight: "700",
    fontSize: 12,
  },
  noExpensesHint: {
    marginTop: 6,
    color: T.textMuted,
    fontWeight: "600",
    fontSize: 12,
  },

  planTotalLabelWrap: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  planTotalLabelText: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  planTotalLabelSub: {
    marginTop: 3,
    color: T.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },

  monthCardsWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  },
  sectionHeadingWrap: {
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  sectionHeading: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  monthCard: {
    backgroundColor: T.card,
    borderWidth: 2,
    borderColor: T.accentBorder,
    borderRadius: 16,
    padding: 16,
  },
  monthCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  monthCardTitle: {
    color: T.text,
    fontWeight: "900",
    fontSize: 14,
    flexShrink: 1,
  },
  monthCardAmount: {
    color: T.text,
    fontWeight: "900",
    fontSize: 14,
  },
  monthCardMeta: {
    marginTop: 6,
    color: T.textDim,
    fontWeight: "700",
    fontSize: 12,
  },

  // Purple hero banner
  purpleHero: {
    backgroundColor: "#2a0a9e",
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: "center",
  },
  purpleHeroLabelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  purpleHeroLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  purpleHeroAmount: {
    color: "#ffffff",
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 2,
  },
  purpleHeroMeta: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  purpleHeroDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  purpleHeroDeltaPct: {
    fontSize: 13,
    fontWeight: "900",
  },
  purpleHeroDeltaText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
  },
  purpleDeltaUp: {
    color: "#7fffc0",
  },
  purpleDeltaDown: {
    color: "#ffb3b3",
  },

  // Month picker modal
  pickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  pickerSheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  pickerYearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  pickerYearBtn: {
    padding: 4,
  },
  pickerYearText: {
    color: T.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerCell: {
    width: "22%",
    height: 52,
    borderRadius: 10,
    backgroundColor: T.cardAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerCellSelected: {
    backgroundColor: "#2a0a9e",
  },
  pickerCellDisabled: {
    opacity: 0.28,
  },
  pickerCellText: {
    color: T.text,
    fontSize: 13,
    fontWeight: "900",
  },
  pickerCellSelectedText: {
    color: "#ffffff",
  },
  pickerCellDisabledText: {
    color: T.textDim,
  },

  // (Additional-plan per-expense list styles removed; we now show the category cards instead.)
});
