"use client";

import { useMemo, useEffect, useState } from "react";
import type { DebtItem, ExpenseItem, MonthKey, PaymentStatus } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";
import { updatePaymentStatus as updateExpensePaymentStatus } from "@/lib/expenses/actions";
import ExpandableCategory from "@/components/ExpandableCategory";
import DebtCategory from "@/components/DebtCategory";
import GoalsDisplay from "@/components/GoalsDisplay";
import PieCategories from "@/components/PieCategories";
import { Card } from "@/components/Shared";
import { Target, Receipt } from "lucide-react";

type GoalLike = {
  id: string;
  title: string;
  targetAmount?: number;
  currentAmount?: number;
  type: "yearly" | "long-term";
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

export default function ViewTabs({
  budgetPlanId,
  month,
  categoryData,
  totalIncome,
  totalExpenses,
  remaining,
  debts,
  totalDebtBalance,
  goals,
  allPlansData,
}: ViewTabsProps) {
  const [budgetPlans, setBudgetPlans] = useState<BudgetPlan[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("personal");

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

  // Combine data for all plans in active tab
  const combinedData = useMemo(() => {
    let totalInc = 0;
    let totalExp = 0;
    let combinedGoals: GoalLike[] = [];
    const categoryTotals: Record<string, number> = {};

    activePlans.forEach(plan => {
      const planData = allPlansData?.[plan.id];
      if (planData) {
        totalInc += planData.totalIncome;
        totalExp += planData.totalExpenses;
        combinedGoals = [...combinedGoals, ...planData.goals];
        
        planData.categoryData.forEach(cat => {
          categoryTotals[cat.name] = (categoryTotals[cat.name] || 0) + cat.total;
        });
      }
    });

    const categoryPieItems = Object.entries(categoryTotals).map(([name, amount]) => ({
      name,
      amount,
    }));

    return {
      totalIncome: totalInc,
      totalExpenses: totalExp,
      remaining: totalInc - totalExp,
      categoryPieItems,
      goals: combinedGoals,
    };
  }, [activePlans, allPlansData]);

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
    <div className="space-y-6">
      <div className="grid grid-cols-3 md:grid-cols-3 gap-2 sm:gap-4">
        <Card title="Income">
          <div className="text-lg sm:text-2xl font-bold">
            <Currency value={combinedData.totalIncome} />
          </div>
        </Card>
        <Card title="Expenses">
          <div className="text-lg sm:text-2xl font-bold">
            <Currency value={combinedData.totalExpenses} />
          </div>
        </Card>
        <Card title="Remaining">
          <div className={`text-lg sm:text-2xl font-bold ${combinedData.remaining < 0 ? "text-red-300" : "text-emerald-300"}`}>
            <Currency value={combinedData.remaining} />
          </div>
        </Card>
      </div>

      {combinedData.categoryPieItems.length > 0 ? (
        <Card title="This Month by Category">
          <PieCategories items={combinedData.categoryPieItems} />
        </Card>
      ) : null}

      <div className="space-y-4">
        <GoalsDisplay goals={combinedData.goals} />
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-white/10 p-2.5 rounded-xl shadow-md backdrop-blur-sm">
            <Receipt size={24} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Expenses</h2>
        </div>

        {/* Budget Plan Pills - only show if more than one tab */}
        {availableTabs.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {availableTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
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

        {/* Show all plans in the active tab */}
        {activePlans.map((plan) => {
          const planData = allPlansData?.[plan.id];
          if (!planData) return null;

          return (
            <div key={plan.id} className="space-y-4">
              {/* Show plan name if multiple plans under this tab */}
              {activePlans.length > 1 && (
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              )}
              
              {planData.categoryData.length === 0 ? (
                <Card title="Categories">
                  <div className="text-sm text-slate-400">No categorized expenses yet for this month.</div>
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
        })}
      </div>
    </div>
  );
}
