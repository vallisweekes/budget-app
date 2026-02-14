"use client";

import { useMemo, useEffect, useState } from "react";
import type { DebtItem, ExpenseItem, MonthKey, PaymentStatus } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";
import { formatMonthKeyLabel, monthKeyToNumber } from "@/lib/helpers/monthKey";
import { updatePaymentStatus as updateExpensePaymentStatus } from "@/lib/expenses/actions";
import ExpandableCategory from "@/components/ExpandableCategory";
import { Card } from "@/components/Shared";
import { Receipt, Plus } from "lucide-react";
import Link from "next/link";

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
};

type TabKey = "personal" | "holiday" | "carnival";

type ViewTabsProps = {
  budgetPlanId: string;
  month: MonthKey;
  categoryData: CategoryDataItem[];
  regularExpenses: ExpenseItem[];
  totalIncome: number;
  totalExpenses: number;
  remaining: number;
  debts: DebtItem[];
  totalDebtBalance: number;
  goals: GoalLike[];
  allPlansData?: Record<string, {
    categoryData: CategoryDataItem[];
    totalIncome: number;
    totalExpenses: number;
    remaining: number;
    goals: GoalLike[];
  }>;
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
  totalExpenses,
  remaining,
  goals,
  allPlansData,
}: ViewTabsProps) {
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
          setBudgetPlans(data.plans);
          // Set active tab based on current budget plan
          const currentPlan = data.plans.find(p => p.id === budgetPlanId);
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

  // Get plans for active tab
  const activePlans = plansByKind[activeTab];

  const fallbackPlanData = useMemo(() => {
    const fromAllPlans = allPlansData?.[budgetPlanId];
    if (fromAllPlans) return fromAllPlans;

    return {
      categoryData,
      totalIncome,
      totalExpenses,
      remaining,
      goals,
    };
  }, [allPlansData, budgetPlanId, categoryData, goals, remaining, totalExpenses, totalIncome]);

  // Combine data for all plans in active tab (with a safe fallback for initial render)
  const combinedData = useMemo(() => {
    const hasMultiPlanData = Boolean(allPlansData) && activePlans.length > 0;
    if (!hasMultiPlanData) {
      return {
        totalIncome: fallbackPlanData.totalIncome,
        totalExpenses: fallbackPlanData.totalExpenses,
        remaining: fallbackPlanData.remaining,
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
    let combinedGoals: GoalLike[] = [];
    const categoryTotals: Record<string, { total: number; color?: string }> = {};
    const flattenedExpenses: ExpenseItem[] = [];

    activePlans.forEach((plan) => {
      const planData = allPlansData?.[plan.id];
      if (!planData) return;

      totalInc += planData.totalIncome;
      totalExp += planData.totalExpenses;
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
      totalExpenses: totalExp,
      remaining: totalInc - totalExp,
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

  const savingsRate = combinedData.totalIncome > 0 ? combinedData.remaining / combinedData.totalIncome : 0;
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
            <div className="flex flex-wrap gap-2">
              {availableTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? "bg-white text-slate-900"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
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

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3">
        <Card title="Income" className="p-3">
          <div className="text-base sm:text-lg font-bold"><Currency value={combinedData.totalIncome} /></div>
        </Card>
        <Card title="Spend" className="p-3">
          <div className="text-base sm:text-lg font-bold"><Currency value={combinedData.totalExpenses} /></div>
        </Card>
        <Card title="Net" className="p-3">
          <div className={`text-base sm:text-lg font-bold ${combinedData.remaining < 0 ? "text-red-300" : "text-emerald-300"}`}>
            <Currency value={combinedData.remaining} />
          </div>
        </Card>
        <Card title="Savings" className="p-3">
          <div className={`text-base sm:text-lg font-bold ${savingsRate < 0 ? "text-red-300" : "text-emerald-300"}`}>{percent(savingsRate)}</div>
          <div className="text-xs text-slate-300">of income</div>
        </Card>
        <Card title="Spend rate" className="p-3">
          <div className="text-base sm:text-lg font-bold">{percent(spendRate)}</div>
          <div className="text-xs text-slate-300">income used</div>
        </Card>
        <Card title="Avg/day" className="p-3">
          <div className="text-base sm:text-lg font-bold"><Currency value={avgSpendPerDay} /></div>
          <div className="text-xs text-slate-300">{daysInMonth} days</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card title="Top categories" className="lg:col-span-7">
          {topCategories.length === 0 ? (
            <div className="text-sm text-slate-300">No categorized spend yet for this month.</div>
          ) : (
            <div className="space-y-3">
              {topCategories.map((c) => {
                const share = combinedData.totalExpenses > 0 ? c.total / combinedData.totalExpenses : 0;
                return (
                  <div key={c.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-white truncate">{c.name}</div>
                      <div className="text-sm text-slate-200 whitespace-nowrap"><Currency value={c.total} /></div>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, share * 100)}%`,
                          background: c.color ?? "rgba(45, 212, 191, 0.8)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-slate-400">Shows top 6 by spend</div>
            <Link href="/admin/expenses" className="text-sm font-medium text-white/90 hover:text-white">
              View expenses
            </Link>
          </div>
        </Card>

        <Card title="Largest expenses" className="lg:col-span-5">
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

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Card title="Debt" className="p-3 bg-white/5">
              <div className="text-base font-bold"><Currency value={totalDebtBalance} /></div>
              <div className="text-xs text-slate-300">this plan</div>
            </Card>
            <Card title="Goals" className="p-3 bg-white/5">
              <div className="text-base font-bold">{combinedData.goals.filter((g) => g.title !== "Pay Back Debts").length}</div>
              <div className="text-xs text-slate-300">active</div>
            </Card>
          </div>
        </Card>
      </div>

      {combinedData.goals.filter((g) => g.title !== "Pay Back Debts").length > 0 ? (
        <Card title="Goals (quick view)">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {combinedData.goals
              .filter((g) => g.title !== "Pay Back Debts")
              .slice(0, 3)
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
          <div className="mt-4 flex justify-end">
            <Link href="/admin/goals" className="text-sm font-medium text-white/90 hover:text-white">
              View all goals
            </Link>
          </div>
        </Card>
      ) : null}

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
          {(activePlans.length > 0 ? activePlans : [{ id: budgetPlanId, name: "This plan", kind: activeTab }]).map(
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
                        }))}
                        total={cat.total}
                        month={month}
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
