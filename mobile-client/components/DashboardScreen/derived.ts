import type { DashboardData, Settings } from "@/lib/apiTypes";
import { MONTH_NAMES_SHORT } from "@/lib/formatting";
import { formatPayPeriodLabel, normalizePayFrequency, resolveActivePayPeriod } from "@/lib/payPeriods";

export function getEffectiveHomepageGoals<T extends { id: string }>(goals: T[], homepageGoalIds: string[] | null | undefined): T[] {
  const preferredGoalIds = Array.isArray(homepageGoalIds) ? homepageGoalIds : [];
  const byId = new Map(goals.map((goal) => [goal.id, goal] as const));
  const preferred = preferredGoalIds
    .map((id) => byId.get(id))
    .filter((goal): goal is T => Boolean(goal));
  const used = new Set(preferred.map((goal) => goal.id));
  const fallback = goals.filter((goal) => !used.has(goal.id));
  return preferred.length >= 2 ? preferred.slice(0, 2) : [...preferred, ...fallback].slice(0, 2);
}

export function buildDashboardDerived(params: {
  dashboard: DashboardData | null;
  settings: Settings | null;
  categorySheet: { id: string; name: string } | null;
}) {
  const { dashboard, settings, categorySheet } = params;

  const totalIncome = dashboard?.totalIncome ?? 0;
  const totalExpenses = dashboard?.totalExpenses ?? 0;
  const totalAllocations = dashboard?.totalAllocations ?? 0;
  const plannedDebtPayments = dashboard?.plannedDebtPayments ?? 0;
  const incomeAfterAllocations = dashboard?.incomeAfterAllocations ?? 0;
  const categories = dashboard?.categoryData ?? [];
  const goals = dashboard?.goals ?? [];
  const debts = dashboard?.debts ?? [];
  const dashboardSummary = dashboard?.dashboardSummary;
  const monthNum = dashboard?.monthNum ?? new Date().getMonth() + 1;
  const year = dashboard?.year ?? new Date().getFullYear();
  const rawConfiguredPayDate = dashboard?.payDate ?? settings?.payDate ?? null;
  const hasPayDateConfigured = Number.isFinite(rawConfiguredPayDate as number) && (rawConfiguredPayDate as number) >= 1;
  const payDate = hasPayDateConfigured ? (rawConfiguredPayDate as number) : 1;
  const payFrequency = normalizePayFrequency(dashboard?.payFrequency ?? settings?.payFrequency);

  const allExpenses = categories.flatMap((c) => c.expenses);
  const amountLeftToBudget = dashboardSummary?.amountLeftToBudget ?? incomeAfterAllocations;
  const amountAfterExpenses = dashboardSummary?.amountAfterExpenses ?? (amountLeftToBudget - totalExpenses);
  const isOverBudgetBySpending = dashboardSummary?.isOverBudgetBySpending ?? (amountAfterExpenses < 0);

  const overLimitDebtCount = dashboardSummary?.overLimitDebtCount ?? debts.filter((d) => {
    const limit = d.creditLimit ?? 0;
    if (!(limit > 0)) return false;
    return (d.currentBalance ?? 0) > limit;
  }).length;
  const hasOverLimitDebt = dashboardSummary?.hasOverLimitDebt ?? (overLimitDebtCount > 0);

  const isOverBudget = dashboardSummary?.isOverBudget ?? (isOverBudgetBySpending || hasOverLimitDebt);

  const paidTotal = dashboardSummary?.paidTotal ?? allExpenses.reduce((acc, e) => acc + (e.paidAmount ?? (e.paid ? e.amount : 0)), 0);
  const totalBudget = dashboardSummary?.totalBudget ?? (amountLeftToBudget > 0 ? amountLeftToBudget : totalIncome);

  function getDebtDueAmount(d: (typeof debts)[number]) {
    const currentBalance = d.currentBalance ?? 0;
    if (!(currentBalance > 0)) return 0;

    // Installment plans are authoritative when configured.
    // This avoids treating stale amount values (often equal to current balance) as monthly due.
    const installmentMonths = d.installmentMonths ?? 0;
    let planned = 0;
    if (installmentMonths > 0) {
      const principal = (d.initialBalance ?? 0) > 0 ? (d.initialBalance as number) : currentBalance;
      if (principal > 0) planned = principal / installmentMonths;
    }

    // If not installment-based, use configured monthly amount.
    if (!(planned > 0)) {
      planned = d.amount ?? 0;
    }

    // Expense-derived debts (missed/partial expenses) with no explicit monthly plan
    // should behave like a remaining due amount.
    if (!(planned > 0) && d.sourceType === "expense") {
      planned = currentBalance;
    }

    planned = Number.isFinite(planned) ? planned : 0;

    const monthlyMinimum = d.monthlyMinimum ?? 0;

    // For credit/store cards the monthly minimum IS the planned payment.
    const isCardType = (d as any).type === "credit_card" || (d as any).type === "store_card";
    if (isCardType && monthlyMinimum > 0) {
      planned = monthlyMinimum;
    } else if (monthlyMinimum > 0) {
      planned = Math.max(planned, monthlyMinimum);
    }

    const due = Math.max(0, planned);
    return Math.min(currentBalance, due);
  }

  const plannedDebtItems = debts
    .filter((d) => (d.currentBalance ?? 0) > 0)
    .map((d) => ({
      id: String(d.id),
      name: String(d.name ?? "").trim() || "Debt",
      amount: getDebtDueAmount(d),
    }))
    .filter((d) => d.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const plannedDebtItemsTotal = plannedDebtItems.reduce((sum, d) => sum + d.amount, 0);

  const clampDay = (y: number, monthIndex: number, day: number) => {
    const lastDay = new Date(y, monthIndex + 1, 0).getDate();
    return new Date(y, monthIndex, Math.min(Math.max(1, day), lastDay));
  };

  const startOfDay = (d: Date) => {
    const x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    return x;
  };

  const endOfDay = (d: Date) => {
    const x = new Date(d.getTime());
    x.setHours(23, 59, 59, 999);
    return x;
  };

  const pay = payDate ?? 1;
  const monthIndex = monthNum - 1;
  // For a given "dashboard month" (which follows pay-period semantics),
  // show the inclusive range: pay day of this month → day before next pay day.
  const start = clampDay(year, monthIndex, pay);
  const end = clampDay(year, monthIndex + 1, pay);
  end.setDate(end.getDate() - 1);

  const rangeLabel = `${start.getDate()} ${MONTH_NAMES_SHORT[start.getMonth()]} - ${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]}`;

  const now = new Date();
  const planCreatedAt = settings?.setupCompletedAt
    ? new Date(settings.setupCompletedAt)
    : settings?.accountCreatedAt
      ? new Date(settings.accountCreatedAt)
      : null;
  const activePeriod = resolveActivePayPeriod({ now, payDate: pay, payFrequency, planCreatedAt });
  const periodStart = activePeriod.start;
  const periodEnd = activePeriod.end;
  const payPeriodStart = startOfDay(periodStart);
  const payPeriodEnd = endOfDay(periodEnd);
  const payPeriodLabel = dashboard?.payPeriodLabel ?? formatPayPeriodLabel(periodStart, periodEnd);

  const previousPeriodEnd = new Date(periodStart.getTime());
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
  const previousPeriod = resolveActivePayPeriod({ now: previousPeriodEnd, payDate: pay, payFrequency, planCreatedAt });
  const previousPayPeriodLabel = dashboard?.previousPayPeriodLabel ?? formatPayPeriodLabel(previousPeriod.start, previousPeriod.end);

  const isDateInPayPeriod = (date: Date | null) => {
    if (!date || Number.isNaN(date.getTime())) return false;
    return date.getTime() >= payPeriodStart.getTime() && date.getTime() <= payPeriodEnd.getTime();
  };

  const UPCOMING_TARGET_COUNT = 3;

  const pickCurrentAndTopUpItems = <T,>(
    items: T[],
    resolveDate: (item: T) => Date | null,
    targetCount: number,
  ) => {
    const inCurrent = items.filter((item) => isDateInPayPeriod(resolveDate(item)));
    if (inCurrent.length >= targetCount) return inCurrent;

    const inCurrentSet = new Set(inCurrent);
    const futureSorted = items
      .filter((item) => !inCurrentSet.has(item))
      .map((item) => ({ item, due: resolveDate(item) }))
      .filter((it): it is { item: T; due: Date } => it.due instanceof Date && !Number.isNaN(it.due.getTime()) && it.due.getTime() > payPeriodEnd.getTime())
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .map((it) => it.item);

    if (inCurrent.length === 0) {
      if (futureSorted.length > 0) return futureSorted;
      return items;
    }

    const needed = Math.max(0, targetCount - inCurrent.length);
    if (needed === 0 || futureSorted.length === 0) return inCurrent;

    return [...inCurrent, ...futureSorted.slice(0, needed)];
  };

  const pickCurrentOrNextPeriodItems = <T,>(
    items: T[],
    resolveDate: (item: T) => Date | null,
  ) => {
    const currentAndTopUp = pickCurrentAndTopUpItems(items, resolveDate, UPCOMING_TARGET_COUNT);
    if (currentAndTopUp.length > 0) return currentAndTopUp;

    const nextDueDate = items
      .map((item) => resolveDate(item))
      .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()) && d.getTime() > payPeriodEnd.getTime())
      .sort((a, b) => a.getTime() - b.getTime())[0];

    if (!nextDueDate) return items;

    const nextPeriod = resolveActivePayPeriod({ now: nextDueDate, payDate: pay, payFrequency, planCreatedAt });
    const nextStart = startOfDay(nextPeriod.start).getTime();
    const nextEnd = endOfDay(nextPeriod.end).getTime();

    const inNext = items.filter((item) => {
      const due = resolveDate(item);
      if (!due || Number.isNaN(due.getTime())) return false;
      const t = due.getTime();
      return t >= nextStart && t <= nextEnd;
    });

    return inNext.length > 0 ? inNext : items;
  };

  const upcomingBase = (dashboard?.expenseInsights?.upcoming ?? []).filter((u) => {
    const id = String(u.id ?? "").toLowerCase();
    if (id.startsWith("debt:") || id.startsWith("debt-expense:")) return false;
    const n = String(u.name ?? "").trim().toLowerCase();
    if (n === "housing: rent" || n === "houing: rent") return false;
    if (n.startsWith("housing") && n.includes("rent")) return false;
    const isOutstanding = (u.status ?? "unpaid") !== "paid" && (Number(u.amount ?? 0) - Number(u.paidAmount ?? 0)) > 0.0001;
    if (!isOutstanding) return false;
    return true;
  });

  const upcoming = pickCurrentOrNextPeriodItems(
    upcomingBase,
    (u) => (u.dueDate ? new Date(u.dueDate) : null),
  ).sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return (Number(b.amount ?? 0) - Number(b.paidAmount ?? 0)) - (Number(a.amount ?? 0) - Number(a.paidAmount ?? 0));
  });

  const resolveDebtDueDate = (d: (typeof debts)[number]) => {
    const dueDateIso = d.dueDate ?? null;
    const dueDay = typeof d.dueDay === "number" && Number.isFinite(d.dueDay) ? d.dueDay : null;

    if (dueDateIso) {
      const parsed = new Date(dueDateIso);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (dueDay != null) {
      const thisMonthDue = clampDay(now.getFullYear(), now.getMonth(), dueDay);
      const todayStart = startOfDay(now);
      if (thisMonthDue.getTime() >= todayStart.getTime()) return thisMonthDue;
      return clampDay(now.getFullYear(), now.getMonth() + 1, dueDay);
    }
    return null;
  };

  const getDebtDaysUntilDue = (d: (typeof debts)[number]) => {
    const dueDate = resolveDebtDueDate(d);

    if (!dueDate) return Number.POSITIVE_INFINITY;

    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.floor((dueDate.getTime() - now.getTime()) / msPerDay);
    return Number.isFinite(days) ? days : Number.POSITIVE_INFINITY;
  };

  const urgencyRank = (daysUntilDue: number) => {
    if (!Number.isFinite(daysUntilDue)) return 3;
    if (daysUntilDue <= 0) return 0; // overdue / today
    if (daysUntilDue <= 7) return 1; // soon
    return 2; // later
  };

  const debtCandidates = debts
    .filter((d) => (d.currentBalance ?? 0) > 0)
    .map((d) => {
      const dueDate = resolveDebtDueDate(d);
      return { ...d, dueAmount: getDebtDueAmount(d), daysUntilDue: getDebtDaysUntilDue(d), dueDateResolved: dueDate };
    })
    .filter((d) => (d.dueAmount ?? 0) > 0)
    // Exclude debts where this month's recorded payments already cover the due amount
    .filter((d) => (d.paidThisMonthAmount ?? 0) < (d.dueAmount ?? 0));

  const upcomingDebts = pickCurrentOrNextPeriodItems(
    debtCandidates,
    (d) => d.dueDateResolved ?? null,
  )
    .sort((a, b) => {
      const aDays = a.daysUntilDue;
      const bDays = b.daysUntilDue;

      const aRank = urgencyRank(aDays);
      const bRank = urgencyRank(bDays);
      if (aRank !== bRank) return aRank - bRank;

      if (aDays !== bDays) return aDays - bDays;

      return (b.dueAmount ?? 0) - (a.dueAmount ?? 0);
    });

  const formatShortDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
  };

  const selectedCategory = categorySheet ? categories.find((c) => c.id === categorySheet.id) : undefined;
  const selectedExpenses = (selectedCategory?.expenses ?? []).slice().sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

  const goalsToShow = getEffectiveHomepageGoals(goals, dashboard?.homepageGoalIds);

  const goalCardsData = goalsToShow.map((g) => ({ kind: "goal" as const, goal: g }));

  return {
    totalIncome,
    totalExpenses,
    totalAllocations,
    plannedDebtPayments,
    incomeAfterAllocations,
    categories,
    goals,
    debts,
    monthNum,
    year,
    payDate,
    hasPayDateConfigured,
    payPeriodLabel,
    previousPayPeriodLabel,
    amountLeftToBudget,
    amountAfterExpenses,
    isOverBudgetBySpending,
    hasOverLimitDebt,
    overLimitDebtCount,
    isOverBudget,
    paidTotal,
    totalBudget,
    plannedDebtItems,
    plannedDebtItemsTotal,
    rangeLabel,
    upcoming,
    upcomingDebts,
    formatShortDate,
    selectedCategory,
    selectedExpenses,
    goalsToShow,
    goalCardsData,
  };
}
