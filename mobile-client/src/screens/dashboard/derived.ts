import type { DashboardData, Settings } from "@/lib/apiTypes";
import { MONTH_NAMES_SHORT } from "@/lib/formatting";
import { formatPayPeriodLabel, normalizePayFrequency, resolveActivePayPeriod } from "@/lib/payPeriods";

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
  const monthNum = dashboard?.monthNum ?? new Date().getMonth() + 1;
  const year = dashboard?.year ?? new Date().getFullYear();
  const rawConfiguredPayDate = dashboard?.payDate ?? settings?.payDate ?? null;
  const hasPayDateConfigured = Number.isFinite(rawConfiguredPayDate as number) && (rawConfiguredPayDate as number) >= 1;
  const payDate = hasPayDateConfigured ? (rawConfiguredPayDate as number) : 1;
  const payFrequency = normalizePayFrequency(dashboard?.payFrequency ?? settings?.payFrequency);

  const allExpenses = categories.flatMap((c) => c.expenses);
  const amountLeftToBudget = incomeAfterAllocations;
  const amountAfterExpenses = amountLeftToBudget - totalExpenses;
  const isOverBudgetBySpending = amountAfterExpenses < 0;

  const overLimitDebts = debts.filter((d) => {
    const limit = d.creditLimit ?? 0;
    if (!(limit > 0)) return false;
    return (d.currentBalance ?? 0) > limit;
  });
  const overLimitDebtCount = overLimitDebts.length;
  const hasOverLimitDebt = overLimitDebtCount > 0;

  // Composite definition matching product semantics:
  // "Over budget" if either (a) net monthly outgoings exceed income-left-to-budget, OR (b) any card is over its credit limit.
  const isOverBudget = isOverBudgetBySpending || hasOverLimitDebt;

  const paidTotal = allExpenses.reduce((acc, e) => acc + (e.paidAmount ?? (e.paid ? e.amount : 0)), 0);
  const totalBudget = amountLeftToBudget > 0 ? amountLeftToBudget : totalIncome;

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
    if (monthlyMinimum > 0) planned = Math.max(planned, monthlyMinimum);

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
  const activePeriod = resolveActivePayPeriod({ now, payDate: pay, payFrequency });
  const periodStart = activePeriod.start;
  const periodEnd = activePeriod.end;
  const payPeriodStart = startOfDay(periodStart);
  const payPeriodEnd = endOfDay(periodEnd);
  const payPeriodLabel = formatPayPeriodLabel(periodStart, periodEnd);

  const previousPeriodEnd = new Date(periodStart.getTime());
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
  const previousPeriod = resolveActivePayPeriod({ now: previousPeriodEnd, payDate: pay, payFrequency });
  const previousPayPeriodLabel = formatPayPeriodLabel(previousPeriod.start, previousPeriod.end);

  const isDateInPayPeriod = (date: Date | null) => {
    if (!date || Number.isNaN(date.getTime())) return false;
    return date.getTime() >= payPeriodStart.getTime() && date.getTime() <= payPeriodEnd.getTime();
  };

  const upcoming = (dashboard?.expenseInsights?.upcoming ?? []).filter((u) => {
    const id = String(u.id ?? "").toLowerCase();
    if (id.startsWith("debt:") || id.startsWith("debt-expense:")) return false;
    const n = String(u.name ?? "").trim().toLowerCase();
    if (n === "housing: rent" || n === "houing: rent") return false;
    if (n.startsWith("housing") && n.includes("rent")) return false;
    const isOutstanding = (u.status ?? "unpaid") !== "paid" && (Number(u.amount ?? 0) - Number(u.paidAmount ?? 0)) > 0.0001;
    if (!isOutstanding) return false;
    const due = u.dueDate ? new Date(u.dueDate) : null;
    if (!isDateInPayPeriod(due)) return false;
    return true;
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

  const upcomingDebts = debts
    .filter((d) => (d.currentBalance ?? 0) > 0)
    .map((d) => {
      const dueDate = resolveDebtDueDate(d);
      return { ...d, dueAmount: getDebtDueAmount(d), daysUntilDue: getDebtDaysUntilDue(d), dueDateResolved: dueDate };
    })
    .filter((d) => (d.dueAmount ?? 0) > 0)
    // Exclude debts where this month's recorded payments already cover the due amount
    .filter((d) => (d.paidThisMonthAmount ?? 0) < (d.dueAmount ?? 0))
    // Show only debts due in the active pay period.
    .filter((d) => isDateInPayPeriod(d.dueDateResolved ?? null))
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

  const preferredGoalIds = Array.isArray(dashboard?.homepageGoalIds) ? dashboard.homepageGoalIds : [];
  const byId = new Map(goals.map((g) => [g.id, g] as const));
  const preferred = preferredGoalIds
    .map((id) => byId.get(id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const used = new Set(preferred.map((g) => g.id));
  const fallback = goals.filter((g) => !used.has(g.id));
  const goalsToShow = (preferred.length >= 2 ? preferred.slice(0, 2) : [...preferred, ...fallback].slice(0, 2));

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
