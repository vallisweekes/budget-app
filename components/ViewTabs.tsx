"use client";

import { useMemo, useState } from "react";
import type { DebtItem, ExpenseItem, MonthKey, PaymentStatus } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";
import { updatePaymentStatus as updateExpensePaymentStatus } from "@/lib/expenses/actions";
import ExpandableCategory from "@/components/ExpandableCategory";
import DebtCategory from "@/components/DebtCategory";
import GoalsDisplay from "@/components/GoalsDisplay";
import PieCategories from "@/components/PieCategories";
import { Card } from "@/components/Shared";

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
};

type TabKey = "overview" | "categories" | "debts" | "goals";

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
}: ViewTabsProps) {
  const [tab, setTab] = useState<TabKey>("overview");

  const updatePaymentStatus = async (
    monthKey: MonthKey,
    id: string,
    status: PaymentStatus,
    partialAmount?: number
  ) => {
    await updateExpensePaymentStatus(budgetPlanId, monthKey, id, status, partialAmount);
  };

  const categoryPieItems = useMemo(
    () => categoryData.map((c) => ({ name: c.name, amount: c.total })),
    [categoryData]
  );

  const tabButtonBase =
    "h-10 px-4 rounded-xl border border-white/10 bg-slate-900/30 text-slate-200 hover:bg-slate-900/50 transition-all";
  const tabButtonActive = "bg-purple-600/30 border-purple-400/30 text-white";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`${tabButtonBase} ${tab === "overview" ? tabButtonActive : ""}`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab("categories")}
          className={`${tabButtonBase} ${tab === "categories" ? tabButtonActive : ""}`}
        >
          Categories
        </button>
        <button
          type="button"
          onClick={() => setTab("debts")}
          className={`${tabButtonBase} ${tab === "debts" ? tabButtonActive : ""}`}
        >
          Loans & Debts
        </button>
        <button
          type="button"
          onClick={() => setTab("goals")}
          className={`${tabButtonBase} ${tab === "goals" ? tabButtonActive : ""}`}
        >
          Goals
        </button>
      </div>

      {tab === "overview" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="Income">
              <div className="text-2xl font-bold">
                <Currency value={totalIncome} />
              </div>
            </Card>
            <Card title="Expenses">
              <div className="text-2xl font-bold">
                <Currency value={totalExpenses} />
              </div>
            </Card>
            <Card title="Remaining">
              <div className={`text-2xl font-bold ${remaining < 0 ? "text-red-300" : "text-emerald-300"}`}>
                <Currency value={remaining} />
              </div>
            </Card>
          </div>

          {categoryPieItems.length > 0 ? (
            <Card title="This Month by Category">
              <PieCategories items={categoryPieItems} />
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "categories" ? (
        <div className="space-y-4">
          {categoryData.length === 0 ? (
            <Card title="Categories">
              <div className="text-sm text-slate-400">No categorized expenses yet for this month.</div>
            </Card>
          ) : (
            categoryData.map((cat) => (
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
                updatePaymentStatus={updatePaymentStatus}
              />
            ))
          )}
        </div>
      ) : null}

      {tab === "debts" ? <DebtCategory debts={debts} totalBalance={totalDebtBalance} /> : null}

      {tab === "goals" ? <GoalsDisplay goals={goals} /> : null}
    </div>
  );
}
