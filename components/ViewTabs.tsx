"use client";

import { useMemo, useEffect, useId, useState } from "react";
import type { DebtItem, ExpenseItem, MonthKey, PaymentStatus } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";
import { formatMonthKeyLabel, monthKeyToNumber } from "@/lib/helpers/monthKey";
import { updatePaymentStatus as updateExpensePaymentStatus } from "@/lib/expenses/actions";
import ExpandableCategory from "@/components/ExpandableCategory";
import { Card, InfoTooltip } from "@/components/Shared";
import { Receipt, Plus } from "lucide-react";
import Link from "next/link";
import PaymentInsightsCards from "@/components/Insights/PaymentInsightsCards";
import PieCategories from "@/components/PieCategories";
import type { PreviousMonthRecap, UpcomingPayment, RecapTip } from "@/lib/expenses/insights";

type GoalLike = {
  id: string;
  title: string;
  targetAmount?: number;
  currentAmount?: number;
  type: "yearly" | "long-term" | "long_term" | "short_term" | "short-term";
  category: "debt" | "savings" | "emergency" | "investment" | "other";
  targetYear?: number;
  description?: string;
};

type CategoryDataItem = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  total: number;
  expenses: ExpenseItem[];
};

type BudgetPlan = {
  id: string;
  name: string;
  kind: string;
  payDate: number;
};

type TabKey = "personal" | "holiday" | "carnival";

type ViewTabsProps = {
  budgetPlanId: string;
  month: MonthKey;
  categoryData: CategoryDataItem[];
  regularExpenses: ExpenseItem[];
  totalIncome: number;
  totalAllocations?: number;
  plannedDebtPayments?: number;
  plannedSavingsContribution?: number;
  incomeAfterAllocations?: number;
  totalExpenses: number;
  remaining: number;
  debts: DebtItem[];
  totalDebtBalance: number;
  goals: GoalLike[];
  allPlansData?: Record<string, {
    categoryData: CategoryDataItem[];
    totalIncome: number;
    totalAllocations?: number;
    plannedDebtPayments?: number;
    plannedSavingsContribution?: number;
    incomeAfterAllocations?: number;
    totalExpenses: number;
    remaining: number;
    goals: GoalLike[];
  }>;
	expenseInsights?: {
		recap: PreviousMonthRecap;
		upcoming: UpcomingPayment[];
    recapTips?: RecapTip[];
	};
};

function Currency({ value }: { value: number }) {
  return <span>{formatCurrency(value)}</span>;
}

function monthDisplayLabel(month: MonthKey): string {
  const raw = formatMonthKeyLabel(month).trim();
  return raw.length ? raw[0] + raw.slice(1).toLowerCase() : raw;
}

function percent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(0)}%`;
}

export default function ViewTabs({
  budgetPlanId,
  month,
  categoryData,
  totalDebtBalance,
  totalIncome,
  totalAllocations,
  plannedDebtPayments,
  plannedSavingsContribution,
  incomeAfterAllocations,
  totalExpenses,
  remaining,
  goals,
  allPlansData,
	expenseInsights,
}: ViewTabsProps) {
  const planTabsLabelId = useId();
  const [budgetPlans, setBudgetPlans] = useState<BudgetPlan[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/bff/budget-plans", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { plans?: BudgetPlan[] };
        if (Array.isArray(data.plans)) {
          const normalizedPlans = data.plans.map((p) => {
            const rawPayDate = (p as unknown as { payDate?: unknown }).payDate;
            const parsedPayDate = typeof rawPayDate === "number" ? rawPayDate : Number(rawPayDate);
            return {
              ...p,
              payDate: Number.isFinite(parsedPayDate) && parsedPayDate > 0 ? parsedPayDate : 27,
            };
          });

          setBudgetPlans(normalizedPlans);
          // Set active tab based on current budget plan
          const currentPlan = normalizedPlans.find((p) => p.id === budgetPlanId);
          if (currentPlan) {
            setActiveTab(currentPlan.kind as TabKey);
          }
        }
      } catch {
        // Non-blocking
      }
    })();
  }, [budgetPlanId]);

  // Group plans by kind
  const plansByKind = useMemo(() => {
    const grouped: Record<TabKey, BudgetPlan[]> = {
      personal: [],
      holiday: [],
      carnival: [],
    };
    budgetPlans.forEach(plan => {
      const kind = plan.kind as TabKey;
      if (grouped[kind]) {
        grouped[kind].push(plan);
      }
    });
    return grouped;
  }, [budgetPlans]);

  // Available tabs (only show tabs that have plans)
  const availableTabs = useMemo(() => {
    const tabs: Array<{ key: TabKey; label: string }> = [];
    if (plansByKind.personal.length > 0) tabs.push({ key: "personal", label: "Personal" });
    if (plansByKind.holiday.length > 0) tabs.push({ key: "holiday", label: "Holiday" });
    if (plansByKind.carnival.length > 0) tabs.push({ key: "carnival", label: "Carnival" });
    return tabs;
  }, [plansByKind]);

  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (availableTabs.some((t) => t.key === activeTab)) return;
    setActiveTab(availableTabs[0].key);
  }, [activeTab, availableTabs]);

  // Get plans for active tab
  const activePlans = plansByKind[activeTab];

  const fallbackPlanData = useMemo(() => {
    const fromAllPlans = allPlansData?.[budgetPlanId];
    if (fromAllPlans) return fromAllPlans;

    return {
      categoryData,
      totalIncome,
      totalAllocations,
      plannedDebtPayments,
      plannedSavingsContribution,
      incomeAfterAllocations,
      totalExpenses,
      remaining,
      goals,
    };
  }, [allPlansData, budgetPlanId, categoryData, goals, incomeAfterAllocations, plannedDebtPayments, remaining, totalAllocations, totalExpenses, totalIncome]);

  // Combine data for all plans in active tab (with a safe fallback for initial render)
  const combinedData = useMemo(() => {
    const hasMultiPlanData = Boolean(allPlansData) && activePlans.length > 0;
    if (!hasMultiPlanData) {
      const allocationsTotal = fallbackPlanData.totalAllocations ?? 0;
      const plannedDebtTotal = fallbackPlanData.plannedDebtPayments ?? 0;
      const leftToBudget =
        typeof fallbackPlanData.incomeAfterAllocations === "number"
          ? fallbackPlanData.incomeAfterAllocations
          : fallbackPlanData.totalIncome - allocationsTotal;

      return {
        totalIncome: fallbackPlanData.totalIncome,
        totalAllocations: allocationsTotal,
        plannedDebtPayments: plannedDebtTotal,
        incomeAfterAllocations: leftToBudget,
        totalExpenses: fallbackPlanData.totalExpenses,
        remaining: fallbackPlanData.remaining,
        amountLeftToBudget: leftToBudget,
        plannedSavingsContribution: fallbackPlanData.plannedSavingsContribution ?? 0,
        categoryTotals: fallbackPlanData.categoryData.map((c) => ({
          name: c.name,
          total: c.total,
          color: c.color,
        })),
        goals: fallbackPlanData.goals,
        flattenedExpenses: fallbackPlanData.categoryData.flatMap((c) => c.expenses ?? []),
      };
    }

    let totalInc = 0;
    let totalExp = 0;
    let allocationsTotal = 0;
    let plannedDebtTotal = 0;
    let leftToBudgetTotal = 0;
    let plannedSavingsTotal = 0;
    let combinedGoals: GoalLike[] = [];
    const categoryTotals: Record<string, { total: number; color?: string }> = {};
    const flattenedExpenses: ExpenseItem[] = [];

    activePlans.forEach((plan) => {
      const planData = allPlansData?.[plan.id];
      if (!planData) return;

      totalInc += planData.totalIncome;
      totalExp += planData.totalExpenses;
      allocationsTotal += planData.totalAllocations ?? 0;
      plannedDebtTotal += planData.plannedDebtPayments ?? 0;
      plannedSavingsTotal += planData.plannedSavingsContribution ?? 0;
      leftToBudgetTotal +=
        typeof planData.incomeAfterAllocations === "number"
          ? planData.incomeAfterAllocations
          : planData.totalIncome - (planData.totalAllocations ?? 0);
      combinedGoals = combinedGoals.concat(planData.goals);

      planData.categoryData.forEach((cat) => {
        const existing = categoryTotals[cat.name];
        categoryTotals[cat.name] = {
          total: (existing?.total ?? 0) + cat.total,
          color: existing?.color ?? cat.color,
        };
        if (Array.isArray(cat.expenses)) flattenedExpenses.push(...cat.expenses);
      });
    });

    return {
      totalIncome: totalInc,
      totalAllocations: allocationsTotal,
      plannedDebtPayments: plannedDebtTotal,
      incomeAfterAllocations: leftToBudgetTotal,
      totalExpenses: totalExp,
      remaining: totalInc - totalExp,
      amountLeftToBudget: leftToBudgetTotal,
      plannedSavingsContribution: plannedSavingsTotal,
      categoryTotals: Object.entries(categoryTotals).map(([name, v]) => ({
        name,
        total: v.total,
        color: v.color,
      })),
      goals: combinedGoals,
      flattenedExpenses,
    };
  }, [activePlans, allPlansData, fallbackPlanData]);

  const topCategories = useMemo(() => {
    return [...combinedData.categoryTotals]
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [combinedData.categoryTotals]);

  const largestExpenses = useMemo(() => {
    return [...combinedData.flattenedExpenses]
      .filter((e) => Number(e.amount) > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [combinedData.flattenedExpenses]);

  const amountAfterExpenses = combinedData.amountLeftToBudget - combinedData.totalExpenses;

  const savingsRate =
    combinedData.totalIncome > 0
      ? (combinedData.plannedSavingsContribution ?? 0) / combinedData.totalIncome
      : 0;
  const spendRate = combinedData.totalIncome > 0 ? combinedData.totalExpenses / combinedData.totalIncome : 0;

  const daysInMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthNumber = monthKeyToNumber(month);
    return new Date(year, monthNumber, 0).getDate();
  }, [month]);

  const avgSpendPerDay = daysInMonth > 0 ? combinedData.totalExpenses / daysInMonth : 0;

  const updatePaymentStatus = async (
    planId: string,
    monthKey: MonthKey,
    id: string,
    status: PaymentStatus,
    partialAmount?: number
  ) => {
    await updateExpensePaymentStatus(planId, monthKey, id, status, partialAmount);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-slate-300">{monthDisplayLabel(month)} snapshot</div>
          <div className="text-xl sm:text-2xl font-bold text-white">Dashboard</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {availableTabs.length > 1 && (
            <>
              <span id={planTabsLabelId} className="sr-only">
                Budget plans
              </span>
              <div
                role="tablist"
                aria-labelledby={planTabsLabelId}
                className="rounded-full border border-white/10 bg-slate-900/35 backdrop-blur-xl shadow-lg p-1"
              >
              {(() => {
                const activeIndex = Math.max(
                  0,
                  availableTabs.findIndex((t) => t.key === activeTab)
                );
                const tabWidth = 100 / availableTabs.length;
                return (
                  <div className="relative flex items-center">
                    <div
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 rounded-full border border-white/10 bg-white shadow-sm transition-transform duration-300 ease-out"
                      style={{
                        width: `${tabWidth}%`,
                        transform: `translateX(${activeIndex * 100}%)`,
                      }}
                    />

                    {availableTabs.map((tab) => {
                      const isActive = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setActiveTab(tab.key)}
                          className={`relative z-10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                            isActive ? "text-slate-900" : "text-slate-200 hover:text-white"
                          }`}
                          style={{ width: `${tabWidth}%` }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              </div>
            </>
          )}

          <Link
            href="/admin/expenses"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
          >
            <Plus size={16} />
            Add expense
          </Link>
          <Link
            href="/admin/income"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
          >
            <Plus size={16} />
            Add income
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
        <Card
          title={
            <span className="inline-flex items-center gap-1.5">
              Income
              <InfoTooltip
                ariaLabel="Income info"
                content="Money left to budget for this month after your planned income sacrifice (allowance, savings contributions, emergency fund, investments) AND your planned debt payments are deducted. This is the pool you still need to assign to spending categories — not your gross income."
              />
            </span>
          }
          className="p-3"
        >
          <div className="flex items-center gap-2">
            <div className="text-base sm:text-lg font-bold"><Currency value={combinedData.amountLeftToBudget} /></div>
            {combinedData.totalIncome > 0 && (
              <span className={`text-xs font-medium ${
                ((combinedData.totalAllocations ?? 0) + (combinedData.plannedDebtPayments ?? 0)) / combinedData.totalIncome > 0.30 ? "text-red-400" : "text-emerald-400"
              }`}>
                {((combinedData.totalAllocations ?? 0) + (combinedData.plannedDebtPayments ?? 0)) / combinedData.totalIncome > 0.30 ? "↑" : "↓"} {percent(((combinedData.totalAllocations ?? 0) + (combinedData.plannedDebtPayments ?? 0)) / combinedData.totalIncome)}
              </span>
            )}
          </div>
        </Card>
        <Card
          title={
            <span className="inline-flex items-center gap-1.5">
              Expenses
              <InfoTooltip
                ariaLabel="Expenses info"
                content="Total expenses recorded for this month across your categories. This includes paid and unpaid items you’ve entered for the month, so it’s a good ‘what you’re actually spending’ number."
              />
            </span>
          }
          className="p-3"
        >
          <div className="flex items-center gap-2">
            <div className="text-base sm:text-lg font-bold"><Currency value={combinedData.totalExpenses} /></div>
            {combinedData.totalIncome > 0 && (
              <span className={`text-xs font-medium ${
                spendRate > 0.70 ? "text-red-400" : spendRate > 0.50 ? "text-amber-400" : "text-emerald-400"
              }`}>
                {spendRate > 0.60 ? "↑" : "↓"} {percent(spendRate)}
              </span>
            )}
          </div>
        </Card>
        <Card
          title={
            <span className="inline-flex items-center gap-1.5">
              Amount Left
              <InfoTooltip
                ariaLabel="Amount left info"
                content="What remains after expenses: (income left to budget after income sacrifice + debt plan) − (this month’s recorded expenses). If this goes negative, you’re overspending vs your plan."
              />
            </span>
          }
          className="p-3"
        >
          <div className="flex items-center gap-2">
            <div className={`text-base sm:text-lg font-bold ${amountAfterExpenses < 0 ? "text-red-300" : "text-emerald-300"}`}>
              <Currency value={amountAfterExpenses} />
            </div>
            {combinedData.amountLeftToBudget > 0 && (
              <span className={`text-xs font-medium ${
                amountAfterExpenses < 0 ? "text-red-400" : "text-emerald-400"
              }`}>
                {amountAfterExpenses < 0 ? "↓" : "↑"} {percent(Math.abs(amountAfterExpenses) / combinedData.amountLeftToBudget)}
              </span>
            )}
          </div>
        </Card>
        <Card
          title={
            <span className="inline-flex items-center gap-1.5">
              Savings
              <InfoTooltip
                ariaLabel="Savings info"
                content="Planned savings contribution coming from your Income sacrifice setup for this month. Think of this as ‘scheduled savings’ (what you intend to move/save), shown as an amount and a % of gross income."
              />
            </span>
          }
          className="p-3"
        >
          <div className="flex items-center gap-2">
            <div className="text-base sm:text-lg font-bold text-emerald-300">
              <Currency value={combinedData.plannedSavingsContribution ?? 0} />
            </div>
            {combinedData.totalIncome > 0 && (
              <span
                className={`text-xs font-medium ${
                  savingsRate > 0 ? "text-emerald-400" : "text-slate-400"
                }`}
              >
                {percent(savingsRate)}
              </span>
            )}
          </div>
        </Card>
        <Card
          title={
            <span className="inline-flex items-center gap-1.5">
              Avg/day
              <InfoTooltip
                ariaLabel="Average per day info"
                content="Average spending per day: (this month’s expenses ÷ days in month). This helps you pace spending; the % compares your average daily spend to your daily budget based on the money left to budget."
              />
            </span>
          }
          className="p-3 col-span-2 lg:col-span-1"
        >
          <div className="flex items-center gap-2">
            <div className="text-base sm:text-lg font-bold"><Currency value={avgSpendPerDay} /></div>
            {combinedData.amountLeftToBudget > 0 && daysInMonth > 0 && (
				(() => {
					const dailyBudget = combinedData.amountLeftToBudget / daysInMonth;
					const spendRate = dailyBudget > 0 ? (avgSpendPerDay / dailyBudget) : 0;
					const isOver = spendRate > 1;
					const isHigh = spendRate >= 0.9;
					return (
						<span className={`text-xs font-medium ${isOver || isHigh ? "text-red-400" : "text-emerald-400"}`}>
							{isOver ? "↑" : isHigh ? "↗" : "↓"} {percent(spendRate)}
						</span>
					);
				})()
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card title={undefined} className="lg:col-span-7">
          <div className="space-y-3">
            <div className="inline-flex">
              <div
                className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900"
                style={{ backgroundColor: "#9EDBFF" }}
              >
                Category expenses
              </div>
            </div>
            {topCategories.length === 0 ? (
              <div className="text-sm text-slate-300">No categorized spend yet for this month.</div>
            ) : (
              <PieCategories items={topCategories.map(c => ({ name: c.name, amount: c.total }))} />
            )}

            <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">Shows top 6 by spend</div>
              <Link href="/admin/expenses" className="text-sm font-medium text-white/90 hover:text-white">
                View expenses
              </Link>
            </div>
          </div>
        </Card>

        <Card title={undefined} className="lg:col-span-5">
          <div className="space-y-3">
            <div className="inline-flex">
              <div
                className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900"
                style={{ backgroundColor: "#9EDBFF" }}
              >
                Largest expenses
              </div>
            </div>
            {largestExpenses.length === 0 ? (
              <div className="text-sm text-slate-300">No expenses yet for this month.</div>
            ) : (
              <div className="space-y-2">
              {largestExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3">
                  <div className="text-sm text-white truncate">{e.name}</div>
                  <div className="text-sm text-slate-200 whitespace-nowrap"><Currency value={e.amount} /></div>
                </div>
              ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
            <Card title="Debt" className="p-3 bg-white/5">
              <div className="text-base font-bold"><Currency value={totalDebtBalance} /></div>
              <div className="text-xs text-slate-300">this plan</div>
            </Card>
            <Card title="Goals" className="p-3 bg-white/5">
              <div className="text-base font-bold">{combinedData.goals.filter((g) => g.title !== "Pay Back Debts").length}</div>
              <div className="text-xs text-slate-300">active</div>
            </Card>
            </div>
          </div>
        </Card>
      </div>

      {combinedData.goals.filter((g) => g.title !== "Pay Back Debts").length > 0 ? (
        <Card title={undefined}>
          <div className="space-y-3">
            <div className="inline-flex">
              <div
                className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900"
                style={{ backgroundColor: "#9EDBFF" }}
              >
                Goals
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {combinedData.goals
              .filter((g) => g.title !== "Pay Back Debts")
              .slice(0, 2)
              .map((g) => {
                const target = g.targetAmount ?? 0;
                const current = g.currentAmount ?? 0;
                const progress = target > 0 ? Math.min(1, current / target) : 0;
                return (
                  <div key={g.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="font-semibold text-white truncate">{g.title}</div>
                    {target > 0 ? (
                      <>
                        <div className="mt-2 flex items-center justify-between text-sm text-slate-200">
                          <span><Currency value={current} /></span>
                          <span><Currency value={target} /></span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-sm text-slate-300">No target amount set</div>
                    )}
                    {g.targetYear ? (
                      <div className="mt-2 text-xs text-slate-400">Target year: {g.targetYear}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Link href="/admin/goals" className="text-sm font-medium text-white/90 hover:text-white">
                Goals Overview
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

		<PaymentInsightsCards
			recap={expenseInsights?.recap}
			recapTips={expenseInsights?.recapTips}
			upcoming={expenseInsights?.upcoming}
		/>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-white/10 p-2 rounded-xl shadow-md backdrop-blur-sm">
            <Receipt size={18} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Expense details</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowExpenseDetails((v) => !v)}
          className="text-sm font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-all"
        >
          {showExpenseDetails ? "Hide" : "Show"}
        </button>
      </div>

      {showExpenseDetails ? (
        <div className="space-y-4">
          {/* Show all plans in the active tab (fallback to current plan if we don't have the list yet) */}
          {(activePlans.length > 0 ? activePlans : [{ id: budgetPlanId, name: "This plan", kind: activeTab, payDate: 27 }]).map(
            (plan) => {
              const planData = allPlansData?.[plan.id] ?? (plan.id === budgetPlanId ? fallbackPlanData : undefined);
              if (!planData) return null;

              return (
                <div key={plan.id} className="space-y-3">
                  {activePlans.length > 1 && (
                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  )}

                  {planData.categoryData.length === 0 ? (
                    <Card title="Categories">
                      <div className="text-center py-6">
                        <div className="text-sm text-slate-400 mb-4">No categorized expenses yet for this month.</div>
                        <Link
                          href="/admin/expenses"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                        >
                          <Plus size={20} />
                          Add Your First Expense
                        </Link>
                      </div>
                    </Card>
                  ) : (
                    planData.categoryData.map((cat) => (
                      <ExpandableCategory
                        key={cat.id}
                        categoryName={cat.name}
                        categoryIcon={cat.icon || "Circle"}
                        categoryColor={cat.color}
                        expenses={(cat.expenses || []).map((e) => ({
                          id: e.id,
                          name: e.name,
                          amount: e.amount,
                          paid: Boolean(e.paid),
                          paidAmount: e.paidAmount ?? 0,
                          dueDate: e.dueDate,
                        }))}
                        total={cat.total}
                        month={month}
                        defaultDueDate={plan.payDate}
                        budgetPlanId={plan.id}
                        updatePaymentStatus={(monthKey, id, status, partialAmount) =>
                          updatePaymentStatus(plan.id, monthKey, id, status, partialAmount)
                        }
                      />
                    ))
                  )}
                </div>
              );
            }
          )}
        </div>
      ) : null}
    </div>
  );
}
