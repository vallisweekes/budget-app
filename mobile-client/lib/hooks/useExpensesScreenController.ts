import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, ScrollView } from "react-native";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { apiFetch } from "@/lib/api";
import type {
  BudgetPlanListItem,
  BudgetPlansResponse,
  Expense,
  ExpenseCategoryBreakdown,
  ExpenseInsights,
  ExpenseMonthsResponse,
  ExpensePayPeriodMonthsResponse,
  ExpenseSummary,
} from "@/lib/apiTypes";
import { clearCachedPayPeriodExpenses, setCachedPayPeriodExpenses } from "@/lib/expensePeriodCache";
import { currencySymbol } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { useYearGuard } from "@/lib/hooks/useYearGuard";
import { buildPayPeriodFromMonthAnchor, getPayPeriodAnchorFromWindow, normalizePayFrequency, resolveActivePayPeriod } from "@/lib/payPeriods";
import type { ExpensesStackParamList } from "@/navigation/types";
import type { ExpensesScreenControllerState } from "@/types/ExpensesScreen.types";

type Props = NativeStackScreenProps<ExpensesStackParamList, "ExpensesList">;

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function useExpensesScreenController({ navigation, route }: Props): ExpensesScreenControllerState {
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
  const skipNextChildFocusReloadRef = useRef(false);
  const lastHandledSkipFocusReloadAtRef = useRef<number | null>(null);
  const plansRef = useRef<BudgetPlanListItem[]>([]);
  const summaryCacheRef = useRef<Record<string, Record<number, Record<number, ExpenseSummary>>>>({});
  const monthsCacheRef = useRef<Record<string, ExpenseMonthsResponse["months"]>>({});
  const cacheSignatureRef = useRef<string | null>(null);

  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<ExpenseSummary | null>(null);
  const [loggedExpensesCount, setLoggedExpensesCount] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

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

    navigation.setParams({ month, year, prevDisabled });
  }, [canDecrement, month, navigation, route.params?.month, route.params?.prevDisabled, route.params?.year, year]);

  const personalPlanId = plans.find((plan) => plan.kind === "personal")?.id ?? null;
  const activePlanId = selectedPlanId ?? personalPlanId;
  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? null;
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

  const planTotalAmount = expenseMonths.reduce((sum, item) => sum + (item.totalAmount ?? 0), 0);
  const prevIsPersonalPlanRef = useRef(true);

  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  const planScrollRef = useRef<ScrollView | null>(null);
  const planViewportWidthRef = useRef(0);
  const planItemLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});

  const activePlanIndex = Math.max(0, plans.findIndex((plan) => plan.id === activePlanId));
  const setPlanByIndex = useCallback((index: number) => {
    if (!plans.length) return;
    const clamped = Math.max(0, Math.min(plans.length - 1, index));
    const next = plans[clamped];
    if (next?.id) setSelectedPlanId(next.id);
  }, [plans]);

  const planSwipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) => (
      Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2
    ),
    onPanResponderRelease: (_event, gestureState) => {
      if (Math.abs(gestureState.dx) < 60) return;
      if (gestureState.dx < 0) setPlanByIndex(activePlanIndex + 1);
      else setPlanByIndex(activePlanIndex - 1);
    },
  }), [activePlanIndex, setPlanByIndex]);

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

  const monthName = useCallback((targetMonth: number) => {
    const names = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    return names[Math.max(1, Math.min(12, targetMonth)) - 1] ?? "";
  }, []);

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

  const periodSpanLabel = useCallback((targetMonth: number) => {
    const safeMonth = Math.max(1, Math.min(12, targetMonth));
    const start = SHORT_MONTHS[(safeMonth + 10) % 12];
    const end = SHORT_MONTHS[(safeMonth + 11) % 12];
    return `${start} - ${end}`;
  }, []);

  const clearExpenseCaches = useCallback(() => {
    summaryCacheRef.current = {};
    monthsCacheRef.current = {};
    clearCachedPayPeriodExpenses();
    setLoadedKey(null);
  }, []);

  useEffect(() => {
    const skipToken = Number(route.params?.skipFocusReloadAt);
    if (!Number.isFinite(skipToken)) return;
    if (lastHandledSkipFocusReloadAtRef.current === skipToken) return;
    lastHandledSkipFocusReloadAtRef.current = skipToken;
    skipNextChildFocusReloadRef.current = true;
  }, [route.params?.skipFocusReloadAt]);

  const effectivePayDate = Number.isFinite(settings?.payDate as number) && (settings?.payDate as number) >= 1
    ? Math.floor(settings?.payDate as number)
    : 27;
  const effectivePayFrequency = normalizePayFrequency(settings?.payFrequency);
  const setupCompletedAt = useMemo(
    () => parsePlanCreatedAt(settings?.setupCompletedAt ?? settings?.accountCreatedAt),
    [parsePlanCreatedAt, settings?.accountCreatedAt, settings?.setupCompletedAt],
  );
  const activePlanCreatedAt = useMemo(
    () => latestResolvedDate(parsePlanCreatedAt(activePlan?.createdAt), setupCompletedAt),
    [activePlan?.createdAt, latestResolvedDate, parsePlanCreatedAt, setupCompletedAt],
  );
  const defaultActivePeriod = useMemo(
    () => resolveActivePayPeriod({
      now: new Date(),
      payDate: effectivePayDate,
      payFrequency: effectivePayFrequency,
      planCreatedAt: activePlanCreatedAt,
    }),
    [activePlanCreatedAt, effectivePayDate, effectivePayFrequency],
  );
  const defaultActiveAnchor = useMemo(
    () => getPayPeriodAnchorFromWindow({ period: defaultActivePeriod, payFrequency: effectivePayFrequency }),
    [defaultActivePeriod, effectivePayFrequency],
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

  const shiftPayPeriodAnchor = useCallback((targetMonth: number, targetYear: number, delta: number) => {
    let nextMonth = targetMonth + delta;
    let nextYear = targetYear;

    while (nextMonth > 12) {
      nextMonth -= 12;
      nextYear += 1;
    }

    while (nextMonth < 1) {
      nextMonth += 12;
      nextYear -= 1;
    }

    return { month: nextMonth, year: nextYear };
  }, []);

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
      { cacheTtlMs: 0 },
    );
    setCachedSummary(planId, targetYear, targetMonth, fresh);
    return fresh;
  }, [getCachedSummary, setCachedSummary]);

  const preloadSummaryWindow = useCallback(async (params: {
    planId: string | null;
    month: number;
    year: number;
    force?: boolean;
  }): Promise<{ current: ExpenseSummary; previous: ExpenseSummary }> => {
    const { planId, month: targetMonth, year: targetYear, force = false } = params;
    const previousPeriod = shiftPayPeriodAnchor(targetMonth, targetYear, -1);
    const nextPeriod = shiftPayPeriodAnchor(targetMonth, targetYear, 1);

    const previousPromise = getOrFetchSummary({ planId, month: previousPeriod.month, year: previousPeriod.year, force });
    const currentPromise = getOrFetchSummary({ planId, month: targetMonth, year: targetYear, force });
    void getOrFetchSummary({ planId, month: nextPeriod.month, year: nextPeriod.year, force }).catch(() => {
      // Best-effort prefetch only.
    });

    const [previous, current] = await Promise.all([previousPromise, currentPromise]);
    return { current, previous };
  }, [getOrFetchSummary, shiftPayPeriodAnchor]);

  const fetchPayPeriodMonths = useCallback(async (targetYear: number, planId: string | null) => {
    const planQp = planId ? `&budgetPlanId=${encodeURIComponent(planId)}` : "";
    return apiFetch<ExpensePayPeriodMonthsResponse>(
      `/api/bff/expenses/pay-period-months?year=${targetYear}${planQp}`,
      { cacheTtlMs: 0 },
    );
  }, []);

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    try {
      setError(null);
      const [bootstrapResult, budgetPlans] = await Promise.all([
        force ? refreshBootstrap({ force: true }) : ensureLoaded(),
        !force && plansRef.current.length > 0
          ? Promise.resolve<BudgetPlansResponse>({ plans: plansRef.current })
          : apiFetch<BudgetPlansResponse>("/api/bff/budget-plans", { cacheTtlMs: force ? 0 : 6000 }),
      ]);

      const loadedSettings = bootstrapResult.settings;
      if (!loadedSettings) {
        throw bootstrapError ?? new Error("Failed to load settings");
      }

      const payDateForResolution = Number.isFinite(loadedSettings.payDate as number) && (loadedSettings.payDate as number) >= 1
        ? Math.floor(loadedSettings.payDate as number)
        : 27;
      const payFrequencyForResolution = normalizePayFrequency(loadedSettings.payFrequency);
      const nextSignature = `${payDateForResolution}:${payFrequencyForResolution}`;
      if (cacheSignatureRef.current !== nextSignature) {
        cacheSignatureRef.current = nextSignature;
        summaryCacheRef.current = {};
        setLoadedKey(null);
      }

      const rawPlans = Array.isArray(budgetPlans?.plans) ? budgetPlans.plans : [];
      const nextPlans = rawPlans.slice().sort((left, right) => {
        const leftPersonal = left.kind === "personal";
        const rightPersonal = right.kind === "personal";
        if (leftPersonal && !rightPersonal) return -1;
        if (!leftPersonal && rightPersonal) return 1;
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
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
        ?? nextPlans.find((plan) => plan.kind === "personal")?.id
        ?? nextPlans[0]?.id
        ?? null;

      const resolvedPlanCreatedAt = latestResolvedDate(
        parsePlanCreatedAt(nextPlans.find((plan) => plan.id === resolvedPlanId)?.createdAt),
        setupCompletedAt,
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
      const shouldUseResolvedDefaultPeriod = (!hasRouteMonth && !hasRouteYear || routeLooksLikeRawCalendarDefault)
        && month === currentCalendarMonth
        && year === currentCalendarYear;

      let months = [] as ExpenseMonthsResponse["months"];
      if (resolvedPlanId) {
        const monthsKey = planCacheKey(resolvedPlanId);
        if (!force && monthsCacheRef.current[monthsKey]) {
          months = [...monthsCacheRef.current[monthsKey]];
        } else {
          const query = `budgetPlanId=${encodeURIComponent(resolvedPlanId)}`;
          const monthsData = await apiFetch<ExpenseMonthsResponse>(`/api/bff/expenses/months?${query}`, { cacheTtlMs: 0 });
          months = Array.isArray(monthsData?.months) ? monthsData.months : [];
          monthsCacheRef.current[monthsKey] = months;
        }
        months.sort((left, right) => (left.year - right.year) || (left.month - right.month));
        setExpenseMonths(months);
      } else {
        setExpenseMonths([]);
      }

      const initialMonth = shouldUseResolvedDefaultPeriod ? resolvedDefaultMonth : month;
      const initialYear = shouldUseResolvedDefaultPeriod ? resolvedDefaultYear : year;
      const initialWindow = await preloadSummaryWindow({
        planId: resolvedPlanId,
        month: initialMonth,
        year: initialYear,
        force,
      });

      let summaryData = initialWindow.current;
      let previousData = initialWindow.previous;
      let targetMonth = initialMonth;
      let targetYear = initialYear;

      if ((Number(summaryData?.totalCount ?? 0) <= 0) && resolvedPlanId) {
        try {
          const query = `budgetPlanId=${encodeURIComponent(resolvedPlanId)}`;
          const insights = await apiFetch<ExpenseInsights>(`/api/bff/expense-insights?${query}`, { cacheTtlMs: 0 });
          const upcoming = Array.isArray(insights?.upcoming) ? insights.upcoming : [];
          const nextDue = upcoming
            .map((item) => (item?.dueDate ? new Date(item.dueDate) : null))
            .filter((date): date is Date => Boolean(date && !Number.isNaN(date.getTime())))
            .sort((left, right) => left.getTime() - right.getTime())[0];

          if (nextDue) {
            const period = resolveActivePayPeriod({
              now: nextDue,
              payDate: payDateForResolution,
              payFrequency: payFrequencyForResolution,
              planCreatedAt: resolvedPlanCreatedAt,
            });
            const anchor = getPayPeriodAnchorFromWindow({ period, payFrequency: payFrequencyForResolution });

            if (anchor.month !== initialMonth || anchor.year !== initialYear) {
              targetMonth = anchor.month;
              targetYear = anchor.year;
              const targetWindow = await preloadSummaryWindow({
                planId: resolvedPlanId,
                month: targetMonth,
                year: targetYear,
                force,
              });
              summaryData = targetWindow.current;
              previousData = targetWindow.previous;
            }
          }
        } catch {
          // Best-effort only.
        }
      }

      const expensesPlanQp = resolvedPlanId ? `&budgetPlanId=${encodeURIComponent(resolvedPlanId)}` : "";
      const payPeriodExpenses = await apiFetch<Expense[]>(
        `/api/bff/expenses?month=${targetMonth}&year=${targetYear}&scope=pay_period${expensesPlanQp}`,
        { cacheTtlMs: 0 },
      );
      const resolvedExpenses = Array.isArray(payPeriodExpenses) ? payPeriodExpenses : [];
      setCachedPayPeriodExpenses({ budgetPlanId: resolvedPlanId, month: targetMonth, year: targetYear }, resolvedExpenses);
      const nextLoggedExpensesCount = resolvedExpenses.filter((entry) => (
        entry.isExtraLoggedExpense && entry.paymentSource !== "income"
      )).length;

      setSummary(summaryData);
      setPreviousSummary(previousData);
      setLoggedExpensesCount(nextLoggedExpensesCount);

      if (targetMonth !== month) setMonth(targetMonth);
      if (targetYear !== year) setYear(targetYear);

      setLoadedKey(`${resolvedPlanId ?? "none"}:${targetYear}-${targetMonth}`);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load expenses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activePlanId, bootstrapError, ensureLoaded, latestResolvedDate, month, parsePlanCreatedAt, planCacheKey, preloadSummaryWindow, refreshBootstrap, route.params?.month, route.params?.year, setupCompletedAt, year]);

  const currentViewKey = `${activePlanId ?? "none"}:${year}-${month}`;
  useEffect(() => {
    if (loadedKey && loadedKey === currentViewKey && summary) return;
    const hasCachedCurrent = Boolean(getCachedSummary(activePlanId, year, month));
    if (!hasCachedCurrent) setLoading(true);
    void load();
  }, [activePlanId, currentViewKey, getCachedSummary, load, loadedKey, month, summary, year]);

  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocusReloadRef.current) {
        skipFirstFocusReloadRef.current = false;
        return;
      }
      if (skipNextChildFocusReloadRef.current) {
        skipNextChildFocusReloadRef.current = false;
        return;
      }
      if (skipNextTabFocusReloadRef.current) {
        skipNextTabFocusReloadRef.current = false;
        return;
      }
      void load();
    }, [load]),
  );

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
    () => Array.from({ length: 12 }, (_, index) => index + 1).filter((targetMonth) => {
      const hasData = (periodCountsByMonth[targetMonth] ?? 0) > 0;
      if (!hasData) return false;
      if (!accountCreatedAt) return true;
      return periodEndFor(pickerYear, targetMonth).getTime() >= accountCreatedAt.getTime();
    }),
    [accountCreatedAt, periodCountsByMonth, periodEndFor, pickerYear],
  );

  const enabledPeriodSet = useMemo(() => new Set(enabledPeriodMonths), [enabledPeriodMonths]);
  const allPeriodMonths = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const selectedPeriodRange = summary?.periodRangeLabel?.trim() || `${monthName(month)} ${year}`;
  const loadingUi = loading || bootstrapLoading;
  const showTopAddExpenseCta = !loading && !error && (summary?.totalCount ?? 0) === 0;
  const showPlanTotalFallback = isAdditionalPlan && (summary?.totalCount ?? 0) === 0 && expenseMonths.length > 0 && planTotalAmount > 0;

  return {
    activePlan,
    addSheetOpen,
    allPeriodMonths,
    categoriesForAddSheet: summary?.categoryBreakdown ?? [],
    currency,
    enabledPeriodSet,
    error,
    expenseMonths,
    isPersonalPlan,
    loadingUi,
    month,
    monthPickerOpen,
    pickerYear,
    planScrollRef,
    planSwipeHandlers: planSwipe.panHandlers,
    planTotalAmount,
    plans,
    previousSummary,
    refreshing,
    selectedPeriodRange,
    selectedPlanTabId: (activePlanId ?? personalPlanId) ?? null,
    showPlanTotalFallback,
    showTopAddExpenseCta,
    summary,
    topHeaderOffset,
    year,
    closeAddSheet: () => setAddSheetOpen(false),
    closeMonthPicker: () => setMonthPickerOpen(false),
    onAddComplete: () => {
      clearExpenseCaches();
      setAddSheetOpen(false);
      setRefreshing(true);
      void load({ force: true });
    },
    onOpenAddSheet: () => setAddSheetOpen(true),
    onOpenMonthPicker: () => {
      setPickerYear(year);
      setMonthPickerOpen(true);
    },
    onPlanItemLayout: (planId: string, x: number, width: number, selected: boolean) => {
      planItemLayoutsRef.current[planId] = { x, width };
      if (selected) requestAnimationFrame(scrollPlanIntoView);
    },
    onPlanTabsLayout: (width: number) => {
      planViewportWidthRef.current = width;
    },
    onPressCategory: (category: ExpenseCategoryBreakdown) => {
      navigation.navigate("CategoryExpenses", {
        categoryId: category.categoryId,
        categoryName: category.name,
        color: category.color,
        icon: category.icon,
        month,
        year,
        budgetPlanId: activePlanId,
        currency,
      });
    },
    onPressPlan: (planId: string) => setSelectedPlanId(planId),
    onPressUpcomingMonth: (targetMonth: number, targetYear: number) => {
      setMonth(targetMonth);
      setYear(targetYear);
    },
    onRefresh: () => {
      clearExpenseCaches();
      setRefreshing(true);
      void load({ force: true });
    },
    onRetry: () => {
      void load();
    },
    onSelectPickerMonth: (targetMonth: number) => {
      if (!enabledPeriodSet.has(targetMonth)) return;
      setMonth(targetMonth);
      setYear(pickerYear);
      setMonthPickerOpen(false);
    },
    setPickerYear,
  };
}

export default useExpensesScreenController;