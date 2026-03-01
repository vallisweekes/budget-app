import type { DashboardData, Settings } from "@/lib/apiTypes";
import { MONTH_NAMES_SHORT } from "@/lib/formatting";

export function buildDashboardDerived(params: {
  dashboard: DashboardData | null;
  settings: Settings | null;
  categorySheet: { id: string; name: string } | null;
}) {
  const { dashboard, settings, categorySheet } = params;

  const totalIncome = dashboard?.totalIncome ?? 0;
  const totalExpenses = dashboard?.totalExpenses ?? 0;
  const incomeAfterAllocations = dashboard?.incomeAfterAllocations ?? 0;
  const categories = dashboard?.categoryData ?? [];
  const goals = dashboard?.goals ?? [];
  const debts = dashboard?.debts ?? [];
  const monthNum = dashboard?.monthNum ?? new Date().getMonth() + 1;
  const year = dashboard?.year ?? new Date().getFullYear();
  const payDate = dashboard?.payDate ?? settings?.payDate ?? 1;

  const allExpenses = categories.flatMap((c) => c.expenses);
  const amountLeftToBudget = incomeAfterAllocations;
  const amountAfterExpenses = amountLeftToBudget - totalExpenses;
  const isOverBudget = amountAfterExpenses < 0;

  const paidTotal = allExpenses.reduce((acc, e) => acc + (e.paidAmount ?? (e.paid ? e.amount : 0)), 0);
  const totalBudget = amountLeftToBudget > 0 ? amountLeftToBudget : totalIncome;

  const clampDay = (y: number, monthIndex: number, day: number) => {
    const lastDay = new Date(y, monthIndex + 1, 0).getDate();
    return new Date(y, monthIndex, Math.min(Math.max(1, day), lastDay));
  };

  const pay = payDate ?? 1;
  const monthIndex = monthNum - 1;
  const end = clampDay(year, monthIndex, pay);
  end.setDate(end.getDate() - 1);
  const start = clampDay(year, monthIndex - 1, pay);
  start.setDate(start.getDate() + 1);

  const rangeLabel = `${start.getDate()} ${MONTH_NAMES_SHORT[start.getMonth()]} - ${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]}`;

  const upcoming = (dashboard?.expenseInsights?.upcoming ?? []).filter((u) => {
    const id = String(u.id ?? "").toLowerCase();
    if (id.startsWith("debt:") || id.startsWith("debt-expense:")) return false;
    const n = String(u.name ?? "").trim().toLowerCase();
    if (n === "housing: rent" || n === "houing: rent") return false;
    if (n.startsWith("housing") && n.includes("rent")) return false;
    return true;
  });

  const getDebtDueAmount = (d: (typeof debts)[number]) => {
    const currentBalance = d.currentBalance ?? 0;
    if (!(currentBalance > 0)) return 0;

    // Expense-derived debts (missed/partial expenses) should behave like a remaining due amount,
    // not like an installment plan.
    if (d.sourceType === "expense") {
      const amt = d.amount ?? currentBalance;
      return Math.min(currentBalance, amt > 0 ? amt : currentBalance);
    }

    // Mirror the server payoff projection's monthly payment selection:
    // plannedMonthlyPayment (= amount) wins; otherwise fall back to installment plan using initialBalance.
    let planned = d.amount ?? 0;
    planned = Number.isFinite(planned) ? planned : 0;

    const installmentMonths = d.installmentMonths ?? 0;
    if (!(planned > 0) && installmentMonths > 0) {
      const principal = (d.initialBalance ?? 0) > 0 ? (d.initialBalance as number) : currentBalance;
      if (principal > 0) planned = principal / installmentMonths;
    }

    const monthlyMinimum = d.monthlyMinimum ?? 0;
    if (monthlyMinimum > 0) planned = Math.max(planned, monthlyMinimum);

    const due = Math.max(0, planned);
    return Math.min(currentBalance, due);
  };

  const getDebtDaysUntilDue = (d: (typeof debts)[number]) => {
    const dueDateIso = d.dueDate ?? null;
    const dueDay = typeof d.dueDay === "number" && Number.isFinite(d.dueDay) ? d.dueDay : null;

    const now = new Date();
    const dueDate = (() => {
      if (dueDateIso) {
        const parsed = new Date(dueDateIso);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      if (dueDay != null) {
        return clampDay(now.getFullYear(), now.getMonth(), dueDay);
      }
      return null;
    })();

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

  const upcomingDebtsThisMonth = debts
    .filter((d) => (d.currentBalance ?? 0) > 0)
    .map((d) => ({ ...d, dueAmount: getDebtDueAmount(d), daysUntilDue: getDebtDaysUntilDue(d) }))
    .filter((d) => (d.dueAmount ?? 0) > 0)
    // Exclude debts where this month's recorded payments already cover the due amount
    .filter((d) => (d.paidThisMonthAmount ?? 0) < (d.dueAmount ?? 0))
    .sort((a, b) => {
      const aDays = a.daysUntilDue;
      const bDays = b.daysUntilDue;

      const aRank = urgencyRank(aDays);
      const bRank = urgencyRank(bDays);
      if (aRank !== bRank) return aRank - bRank;

      if (aDays !== bDays) return aDays - bDays;

      return (b.dueAmount ?? 0) - (a.dueAmount ?? 0);
    });

  // If everything is covered for this month, show next month's upcoming debts instead.
  // (Next month payments are assumed not yet recorded, so we don't apply the paidThisMonth filter.)
  const upcomingDebts = upcomingDebtsThisMonth.length
    ? upcomingDebtsThisMonth
    : debts
        .filter((d) => (d.currentBalance ?? 0) > 0)
        .map((d) => ({ ...d, dueAmount: getDebtDueAmount(d), daysUntilDue: getDebtDaysUntilDue(d) }))
        .filter((d) => (d.dueAmount ?? 0) > 0)
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
    incomeAfterAllocations,
    categories,
    goals,
    debts,
    monthNum,
    year,
    payDate,
    amountLeftToBudget,
    amountAfterExpenses,
    isOverBudget,
    paidTotal,
    totalBudget,
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
