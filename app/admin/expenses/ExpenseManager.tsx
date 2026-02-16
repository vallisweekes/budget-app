"use client";

import { useMemo, useState, useTransition } from "react";
import type { SyntheticEvent } from "react";
import { useFormStatus } from "react-dom";
import type { MonthKey, ExpenseItem } from "@/types";
import { addExpenseAction, togglePaidAction, updateExpenseAction, removeExpenseAction, applyExpensePaymentAction } from "./actions";
import { Trash2, Plus, Check, X, ChevronDown, ChevronUp, Search, Pencil, TrendingUp } from "lucide-react";
import CategoryIcon from "@/components/CategoryIcon";
import { ConfirmModal, SelectDropdown, Skeleton, SkeletonText } from "@/components/Shared";
import { formatCurrency } from "@/lib/helpers/money";
import { MONTHS } from "@/lib/constants/time";
import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import Link from "next/link";
import { useRouter } from "next/navigation";

const dueDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatIsoDueDate(iso: string): string {
  // Expect YYYY-MM-DD. Parse as UTC to avoid timezone day shifts.
  const match = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  if (!match) return iso;
  const [year, month, day] = iso.split("-").map((x) => Number(x));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return iso;
  return dueDateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface BudgetPlanOption {
  id: string;
  name: string;
  kind: string;
}

interface ExpenseManagerProps {
	budgetPlanId: string;
  month: MonthKey;
  year: number;
  expenses: ExpenseItem[];
  categories: Category[];
  loading?: boolean;
  allPlans?: BudgetPlanOption[];
  allCategoriesByPlan?: Record<string, Category[]>;
  payDate: number;
}

function ExpenseCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/10"
        >
          <div className="p-6 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="min-w-[180px]">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="mt-2 h-4 w-24" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-7 w-28 ml-auto" />
                <Skeleton className="mt-2 h-4 w-20 ml-auto" />
              </div>
            </div>
          </div>

          <div className="p-5">
            <SkeletonText lines={3} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Currency({ value }: { value: number }) {
  return <span>{formatCurrency(value)}</span>;
}

function SaveExpenseChangesButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 px-4 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export default function ExpenseManager({ budgetPlanId, month, year, expenses, categories, loading, allPlans, allCategoriesByPlan, payDate }: ExpenseManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAdding, startAddTransition] = useTransition();
  const isPeriodLoading = Boolean(loading);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({ uncategorized: true });
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [minAmountFilter, setMinAmountFilter] = useState<number | null>(null);
  const [paymentByExpenseId, setPaymentByExpenseId] = useState<Record<string, string>>({});
  const [expensePendingDelete, setExpensePendingDelete] = useState<ExpenseItem | null>(null);
  const [expensePendingEdit, setExpensePendingEdit] = useState<ExpenseItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editDueDate, setEditDueDate] = useState<string>("");
  const [addMonth, setAddMonth] = useState<MonthKey>(month);
  const [addYear, setAddYear] = useState<number>(year);
  const [addBudgetPlanId, setAddBudgetPlanId] = useState<string>(budgetPlanId);
  const [distributeAllMonths, setDistributeAllMonths] = useState(false);
  const [distributeAllYears, setDistributeAllYears] = useState(false);

  const [inlineAddCategoryId, setInlineAddCategoryId] = useState<string | null>(null);
  const [inlineAddError, setInlineAddError] = useState<string | null>(null);

  const YEARS = useMemo(() => {
    const base = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => base + i);
  }, []);

  // Get categories for the selected budget plan when adding
  const addFormCategories = useMemo(() => {
    if (addBudgetPlanId && allCategoriesByPlan && allCategoriesByPlan[addBudgetPlanId]?.length) {
      return allCategoriesByPlan[addBudgetPlanId];
    }
    return categories;
  }, [addBudgetPlanId, allCategoriesByPlan, categories]);

  // Toggle category collapse
  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !(prev[categoryId] ?? true)
    }));
  };

  const effectiveCategories = categories;

  const handleAddExpenseSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPeriodLoading) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    setAddError(null);

    startAddTransition(() => {
      void (async () => {
        try {
          await addExpenseAction(formData);
          setShowAddForm(false);
          router.refresh();
        } catch {
          setAddError("Could not add expense. Please try again.");
        }
      })();
    });
  };

  const handleInlineAddExpenseSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPeriodLoading) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    setInlineAddError(null);

    startAddTransition(() => {
      void (async () => {
        try {
          await addExpenseAction(formData);
          setInlineAddCategoryId(null);
          router.refresh();
        } catch {
          setInlineAddError("Could not add expense. Please try again.");
        }
      })();
    });
  };

  // Group expenses by category
  const categoryLookup = effectiveCategories.reduce((acc, cat) => {
    acc[cat.id] = cat;
    return acc;
  }, {} as Record<string, Category>);

  // Filter expenses by search query
  const filteredExpenses = useMemo(() => {
    let result = expenses;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((expense) =>
        expense.name.toLowerCase().includes(query) ||
        expense.amount.toString().includes(query) ||
        (expense.categoryId && categoryLookup[expense.categoryId]?.name.toLowerCase().includes(query))
      );
    }

    if (statusFilter === "paid") {
      result = result.filter((expense) => expense.paid);
    } else if (statusFilter === "unpaid") {
      result = result.filter((expense) => !expense.paid);
    }

    if (minAmountFilter != null) {
      result = result.filter((expense) => expense.amount >= minAmountFilter);
    }

    return result;
  }, [expenses, searchQuery, statusFilter, minAmountFilter, categoryLookup]);

  const uncategorized = filteredExpenses.filter(e => !e.categoryId);
  const categorized = filteredExpenses.filter(e => e.categoryId);

  const expensesByCategory = categorized.reduce((acc, e) => {
    if (e.categoryId) {
      if (!acc[e.categoryId]) acc[e.categoryId] = [];
      acc[e.categoryId].push(e);
    }
    return acc;
  }, {} as Record<string, ExpenseItem[]>);

  const handleTogglePaid = (expenseId: string) => {
    startTransition(() => {
		togglePaidAction(budgetPlanId, month, expenseId, year);
    });
  };

  const handleRemoveClick = (expense: ExpenseItem) => {
    setExpensePendingDelete(expense);
  };

  const handleEditClick = (expense: ExpenseItem) => {
    setExpensePendingEdit(expense);
    setEditName(expense.name);
    setEditAmount(String(expense.amount));
    setEditCategoryId(expense.categoryId ?? "");
    setEditDueDate(expense.dueDate || "");
  };

  const confirmRemove = () => {
    const expense = expensePendingDelete;
    if (!expense) return;

    startTransition(() => {
      removeExpenseAction(budgetPlanId, month, expense.id, year);
    });
  };

  const handleApplyPayment = (expenseId: string) => {
    const raw = paymentByExpenseId[expenseId];
    const paymentAmount = Number(raw);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return;

    startTransition(() => {
      applyExpensePaymentAction(budgetPlanId, month, expenseId, paymentAmount, year);
    });

    setPaymentByExpenseId((prev) => ({ ...prev, [expenseId]: "" }));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmModal
        open={expensePendingDelete != null}
        title="Delete expense?"
        description={
          expensePendingDelete
            ? `This will permanently delete \"${expensePendingDelete.name}\".`
            : undefined
        }
        tone="danger"
        confirmText="Delete"
        cancelText="Keep"
        isBusy={isPending}
        onClose={() => {
          if (!isPending) setExpensePendingDelete(null);
        }}
        onConfirm={() => {
          confirmRemove();
          setExpensePendingDelete(null);
        }}
      />

      {/* Edit Expense Modal */}
      {expensePendingEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => {
              if (!isPending) setExpensePendingEdit(null);
            }}
            aria-label="Close dialog"
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-slate-800/50 backdrop-blur-xl shadow-2xl"
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Edit expense</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Update the name, amount, or category. Payments remain intact.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isPending) setExpensePendingEdit(null);
                  }}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-slate-900/30 text-slate-200 hover:bg-slate-900/50 transition-all"
                  aria-label="Close"
                  disabled={isPending}
                >
                  <X size={18} className="mx-auto" />
                </button>
              </div>

              <form
                action={updateExpenseAction}
                className="mt-6 space-y-5"
              >
                <input type="hidden" name="budgetPlanId" value={budgetPlanId} />
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="year" value={year} />
                <input type="hidden" name="id" value={expensePendingEdit.id} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium text-slate-300 mb-2 block">Expense Name</span>
                    <input
                      name="name"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
                      placeholder="e.g., Monthly Rent"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-300 mb-2 block">Amount (£)</span>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      required
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
                      placeholder="0.00"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-300 mb-2 block">Category</span>
                    <SelectDropdown
                      name="categoryId"
                      value={editCategoryId}
                      onValueChange={(v) => setEditCategoryId(v)}
                      placeholder="Select Category"
                      options={[
                        ...effectiveCategories.map((c) => ({ value: c.id, label: c.name })),
						{ value: "", label: "Miscellaneous" },
                      ]}
                      buttonClassName="focus:ring-purple-500/50"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-300 mb-2 block">Due Date (Day of Month)</span>
                    <input
                      name="dueDate"
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
                      placeholder="Optional (defaults to pay date)"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setExpensePendingEdit(null)}
                    disabled={isPending}
                    className="h-10 px-4 rounded-xl border border-white/10 bg-slate-900/40 text-slate-200 hover:bg-slate-900/60 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <SaveExpenseChangesButton />
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Header with Search and Add Button */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-white truncate">Expenses</h2>
			<p className="text-slate-400 text-xs sm:text-sm mt-0.5">{formatMonthKeyLabel(month)} {year}</p>
          </div>
          <button
            disabled={isPeriodLoading || isAdding}
            onClick={() => {
              setShowAddForm((prev) => {
                const next = !prev;
                if (next) {
                  setAddMonth(month);
                  setAddYear(year);
                  setAddBudgetPlanId(budgetPlanId);
                  setDistributeAllMonths(false);
                  setDistributeAllYears(false);
                  setAddError(null);
                }
                return next;
              });
            }}
            className={`bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg sm:rounded-xl py-2 sm:py-3 px-3 sm:px-5 text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
              isPeriodLoading || isAdding ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {showAddForm ? <X size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />}
            <span className="hidden sm:inline">{showAddForm ? "Cancel" : "Add Expense"}</span>
          </button>
        </div>

        {/* Search Bar */}
        <label className="block">
          <span className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5 sm:mb-2">Search</span>
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search expenses by name, amount, or cate"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-12 pr-9 sm:pr-10 py-2 sm:py-2.5 text-sm bg-slate-800/40 backdrop-blur-xl border border-white/10 text-white placeholder-slate-400 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X size={14} className="sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </label>

        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-[10px] sm:text-xs font-medium text-slate-400 mr-0.5 sm:mr-1">Filters:</span>

          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border ${
              statusFilter === "all"
                ? "bg-purple-500/20 text-purple-200 border-purple-400/30"
                : "bg-slate-900/30 text-slate-300 border-white/10 hover:bg-slate-900/50"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("paid")}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border ${
              statusFilter === "paid"
                ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
                : "bg-slate-900/30 text-slate-300 border-white/10 hover:bg-slate-900/50"
            }`}
          >
            Paid
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("unpaid")}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border ${
              statusFilter === "unpaid"
                ? "bg-red-500/20 text-red-200 border-red-400/30"
                : "bg-slate-900/30 text-slate-300 border-white/10 hover:bg-slate-900/50"
            }`}
          >
            Unpaid
          </button>

          <span className="text-[10px] sm:text-xs font-medium text-slate-400 mx-0.5 sm:mx-1">Amount:</span>

          <button
            type="button"
            onClick={() => setMinAmountFilter(null)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border ${
              minAmountFilter == null
                ? "bg-purple-500/20 text-purple-200 border-purple-400/30"
                : "bg-slate-900/30 text-slate-300 border-white/10 hover:bg-slate-900/50"
            }`}
          >
            Any
          </button>
          <button
            type="button"
            onClick={() => setMinAmountFilter(100)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border ${
              minAmountFilter === 100
                ? "bg-purple-500/20 text-purple-200 border-purple-400/30"
                : "bg-slate-900/30 text-slate-300 border-white/10 hover:bg-slate-900/50"
            }`}
          >
            £100+
          </button>
          <button
            type="button"
            onClick={() => setMinAmountFilter(500)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border ${
              minAmountFilter === 500
                ? "bg-purple-500/20 text-purple-200 border-purple-400/30"
                : "bg-slate-900/30 text-slate-300 border-white/10 hover:bg-slate-900/50"
            }`}
          >
            £500+
          </button>

          {(searchQuery.trim() || statusFilter !== "all" || minAmountFilter != null) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setMinAmountFilter(null);
              }}
              className="ml-auto px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium bg-slate-900/30 text-slate-300 border border-white/10 hover:bg-slate-900/50 transition-all cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400">
          {isPeriodLoading ? (
            <span className="inline-flex items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </span>
          ) : (
            <>
              Showing <span className="text-slate-200 font-medium">{filteredExpenses.length}</span> of{" "}
              <span className="text-slate-200 font-medium">{expenses.length}</span> expenses
            </>
          )}
        </div>
      </div>

      {/* Add Expense Form */}
      {showAddForm && !isPeriodLoading && (
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-white/10">
          <form onSubmit={handleAddExpenseSubmit} className="space-y-6">
            <input type="hidden" name="budgetPlanId" value={addBudgetPlanId} />
        <input type="hidden" name="month" value={addMonth} />
        <input type="hidden" name="year" value={addYear} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {allPlans && allPlans.length > 1 && (
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-300 mb-2 block">Budget Plan</span>
              <SelectDropdown
                name="_budgetPlanSelect"
                value={addBudgetPlanId}
                onValueChange={(v) => {
                  setAddBudgetPlanId(v);
                  setAddError(null);
                }}
                options={allPlans.map((p) => ({ 
                  value: p.id, 
                  label: `${p.name} (${p.kind.charAt(0).toUpperCase() + p.kind.slice(1)})` 
                }))}
                buttonClassName="focus:ring-purple-500/50"
              />
            </label>
          )}

          <label className="block md:col-span-1">
            <span className="text-sm font-medium text-slate-300 mb-2 block">Month</span>
            <SelectDropdown
              name="_monthSelect"
              value={addMonth}
              onValueChange={(v) => setAddMonth(v as MonthKey)}
			  options={MONTHS.map((m) => ({ value: m, label: formatMonthKeyLabel(m) }))}
              buttonClassName="focus:ring-purple-500/50"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-300 mb-2 block">Year</span>
            <SelectDropdown
              name="_yearSelect"
              value={String(addYear)}
              onValueChange={(v) => setAddYear(Number(v))}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
              buttonClassName="focus:ring-purple-500/50"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
            <input
              type="checkbox"
              name="distributeMonths"
              checked={distributeAllMonths}
              onChange={(e) => setDistributeAllMonths(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-900/60 text-purple-500 focus:ring-purple-500"
            />
            Distribute across all months
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
            <input
              type="checkbox"
              name="distributeYears"
              checked={distributeAllYears}
              onChange={(e) => setDistributeAllYears(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-900/60 text-purple-500 focus:ring-purple-500"
            />
            Distribute across all years
          </label>
        </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="block">
                <span className="text-sm font-medium text-slate-300 mb-2 block">Expense Name</span>
                <input
                  name="name"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
                  placeholder="e.g., Monthly Rent"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300 mb-2 block">Amount (£)</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
                  placeholder="0.00"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300 mb-2 block">Category</span>
                <SelectDropdown
                  name="categoryId"
                  placeholder="Select Category"
                  options={[
                    ...addFormCategories.map((c) => ({ value: c.id, label: c.name })),
					{ value: "", label: "Miscellaneous" },
                  ]}
                  buttonClassName="focus:ring-purple-500/50"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300 mb-2 block">Payment Status</span>
                <SelectDropdown
                  name="paid"
                  defaultValue="false"
                  options={[
                    { value: "false", label: "Not Paid" },
                    { value: "true", label: "Paid" },
                  ]}
                  buttonClassName="focus:ring-purple-500/50"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isPeriodLoading || isAdding}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl py-3 font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isAdding ? "Adding…" : "Add Expense"}
            </button>

            {addError && <p className="text-sm text-red-200">{addError}</p>}
          </form>
        </div>
      )}

      {/* Expenses by Category - Collapsible */}
      {isPeriodLoading ? (
        <ExpenseCardsSkeleton />
      ) : (
      <div className="grid grid-cols-1 gap-3">
        {Object.entries(expensesByCategory).map(([catId, catExpenses]) => {
          const category = categoryLookup[catId];
          if (!category) return null;

          const colorMap: Record<string, string> = {
            blue: "from-blue-400 to-blue-600",
            yellow: "from-yellow-400 to-yellow-600",
            purple: "from-purple-400 to-purple-600",
            orange: "from-orange-400 to-orange-600",
            green: "from-green-400 to-green-600",
            indigo: "from-indigo-400 to-indigo-600",
            pink: "from-pink-400 to-pink-600",
            cyan: "from-cyan-400 to-cyan-600",
            red: "from-red-400 to-red-600",
            emerald: "from-emerald-400 to-emerald-600",
            teal: "from-teal-400 to-teal-600",
            amber: "from-amber-400 to-amber-600",
            slate: "from-slate-400 to-slate-600",
          };

          const gradient = colorMap[category.color ?? "blue"] || colorMap.blue;
          const totalAmount = catExpenses.reduce((sum, e) => sum + e.amount, 0);
          const paidCount = catExpenses.filter((e) => e.paid).length;
          const isCollapsed = collapsedCategories[catId] ?? true;

          return (
            <div
              key={catId}
              className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/10 hover:shadow-2xl transition-all"
            >
              <button
                type="button"
                onClick={() => toggleCategory(catId)}
                className="w-full p-3 sm:p-4 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40 hover:from-slate-900/80 hover:to-slate-900/60 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl sm:rounded-2xl shadow-lg shrink-0`}
                    >
                      <CategoryIcon iconName={category.icon ?? "Circle"} size={20} className="text-white sm:w-6 sm:h-6" />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <h3 className="font-bold text-sm sm:text-base text-white truncate">{category.name}</h3>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
                        {catExpenses.length} {catExpenses.length === 1 ? "expense" : "expenses"} · Due day {payDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-base sm:text-xl font-bold text-white">
                        <Currency value={totalAmount} />
                      </div>
                      <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                        {paidCount} / {catExpenses.length} paid
                      </div>
                    </div>
                    <div className="text-slate-400">
                      {isCollapsed ? <ChevronDown size={20} className="sm:w-6 sm:h-6" /> : <ChevronUp size={20} className="sm:w-6 sm:h-6" />}
                    </div>
                  </div>
                </div>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-white/10">
                  <div className="p-2 sm:p-4 bg-slate-900/20">
                    {inlineAddCategoryId === catId ? (
                      <form onSubmit={handleInlineAddExpenseSubmit} className="space-y-2">
                        <input type="hidden" name="budgetPlanId" value={budgetPlanId} />
                        <input type="hidden" name="month" value={month} />
                        <input type="hidden" name="year" value={year} />
                        <input type="hidden" name="categoryId" value={catId} />
                        <input type="hidden" name="paid" value="false" />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            name="name"
                            required
                            className="sm:col-span-2 w-full px-3 py-2 rounded-xl border border-white/10 bg-slate-900/40 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all"
                            placeholder={`Add to ${category.name}…`}
                          />
                          <input
                            name="amount"
                            type="number"
                            step="0.01"
                            required
                            className="w-full px-3 py-2 rounded-xl border border-white/10 bg-slate-900/40 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all"
                            placeholder="0.00"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setInlineAddCategoryId(null)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 border border-white/10 bg-white/5 hover:bg-white/10 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isAdding}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-emerald-400/30 bg-emerald-500/20 hover:bg-emerald-500/30 transition disabled:opacity-60"
                          >
                            <Plus size={14} />
                            {isAdding ? "Adding…" : "Add"}
                          </button>
                        </div>

                        {inlineAddError ? <p className="text-xs text-red-200">{inlineAddError}</p> : null}
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] sm:text-xs text-slate-400">
                          Add a new expense for {formatMonthKeyLabel(month)} {year}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setInlineAddError(null);
                            setInlineAddCategoryId(catId);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-semibold text-white border border-white/10 bg-white/5 hover:bg-white/10 transition"
                        >
                          <Plus size={14} />
                          Add expense
                        </button>
                      </div>
                    )}
                  </div>
                  {catExpenses.map((expense) => (
                    <div key={expense.id} className="p-2 sm:p-4 hover:bg-slate-900/40 transition-all group">
                      {(() => {
                        const isPaid = !!expense.paid;

                        return (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 sm:mb-1 flex-wrap">
                            <div className="font-semibold text-white text-xs sm:text-sm truncate">{expense.name}</div>
                            <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              expense.dueDate 
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' 
                                : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                            }`}>
                              Due: {expense.dueDate ? formatIsoDueDate(expense.dueDate) : `Day ${payDate}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <span className="text-slate-300 font-medium">
                              <Currency value={expense.amount} />
                            </span>
                          </div>

              {(() => {
                const paidAmount = isPaid ? expense.amount : (expense.paidAmount ?? 0);
                const remaining = Math.max(0, expense.amount - paidAmount);
                return (
                  <div className="mt-1.5 sm:mt-2 flex flex-col gap-1.5 sm:gap-2">
                    <div className="flex-1">
                      <div className="text-[10px] sm:text-xs text-slate-400">
                        Paid <span className="text-slate-200 font-medium"><Currency value={paidAmount} /></span> · Remaining{" "}
                        <span className="text-slate-200 font-medium"><Currency value={remaining} /></span>
                      </div>
                      <div className="mt-1.5 h-1.5 sm:h-2 w-full rounded-full bg-slate-900/40 border border-white/10 overflow-hidden">
                        <div
                          className={`h-full ${remaining === 0 ? "bg-emerald-500/70" : "bg-purple-500/70"}`}
                          style={{ width: `${Math.min(100, (paidAmount / Math.max(1, expense.amount)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {remaining > 0 && (
                      <div className="w-full">
                        <label className="block">
                          <span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1">Payment amount (£)</span>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={paymentByExpenseId[expense.id] ?? ""}
                              onChange={(e) =>
                                setPaymentByExpenseId((prev) => ({ ...prev, [expense.id]: e.target.value }))
                              }
                              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-white/10 bg-slate-900/40 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all"
                              placeholder="0.00"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyPayment(expense.id)}
                              disabled={isPending}
                              className="shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-purple-500/20 text-purple-200 border border-purple-400/30 hover:bg-purple-500/30 transition-all cursor-pointer disabled:opacity-50 text-[10px] sm:text-xs whitespace-nowrap"
                            >
                              Add payment
                            </button>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })()}
                        </div>

                        <div className="flex flex-col items-end gap-1.5 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePaid(expense.id)}
                            disabled={isPending}
                            className={`h-8 sm:h-9 min-w-[76px] sm:min-w-[88px] px-2 sm:px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] flex items-center justify-center gap-1 sm:gap-1.5 ${
                              isPaid
                                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            }`}
                            aria-label={isPaid ? "Mark as unpaid" : "Mark as paid"}
                          >
                            {isPaid ? (
                              <>
                                <Check size={16} className="sm:w-[18px] sm:h-[18px]" />
                                <span>Paid</span>
                              </>
                            ) : (
                              <span>Unpaid</span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEditClick(expense)}
                            disabled={isPending}
                            className="h-8 sm:h-9 w-8 sm:w-9 rounded-lg sm:rounded-xl hover:bg-purple-500/20 text-purple-200 transition-all cursor-pointer hover:scale-[1.05] flex items-center justify-center"
                            title="Edit expense"
                          >
                            <Pencil size={14} className="sm:w-4 sm:h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveClick(expense)}
                            disabled={isPending}
                            className="h-8 sm:h-9 w-8 sm:w-9 rounded-lg sm:rounded-xl hover:bg-red-500/20 text-red-400 transition-all cursor-pointer hover:scale-[1.05] flex items-center justify-center"
                            title="Delete expense"
                          >
                            <Trash2 size={14} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Miscellaneous Expenses (no category) - Collapsible */}
      {!isPeriodLoading && uncategorized.length > 0 && (
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/10 hover:shadow-2xl transition-all">
          <button
            type="button"
            onClick={() => toggleCategory("uncategorized")}
            className="w-full p-3 sm:p-4 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40 hover:from-slate-900/80 hover:to-slate-900/60 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-600 rounded-xl sm:rounded-2xl shadow-lg shrink-0">
                  <span className="text-lg sm:text-xl">📋</span>
                </div>
                <div className="text-left min-w-0 flex-1">
					  <h3 className="font-bold text-sm sm:text-base text-white truncate">Miscellaneous</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
                    {uncategorized.length} {uncategorized.length === 1 ? "expense" : "expenses"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="text-base sm:text-xl font-bold text-white">
                  <Currency value={uncategorized.reduce((sum, e) => sum + e.amount, 0)} />
                </div>
                <div className="text-slate-400">
                  {collapsedCategories.uncategorized ? <ChevronDown size={20} className="sm:w-6 sm:h-6" /> : <ChevronUp size={20} className="sm:w-6 sm:h-6" />}
                </div>
              </div>
            </div>
          </button>

          {!(collapsedCategories.uncategorized ?? true) && (
            <div className="divide-y divide-white/10">
              {uncategorized.map((expense) => (
                <div key={expense.id} className="p-3 sm:p-4 hover:bg-slate-900/40 transition-all group">
                  {(() => {
                    const isPaid = !!expense.paid;

                    return (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-xs sm:text-sm mb-1 truncate">{expense.name}</div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <span className="text-slate-300 font-medium">
                          <Currency value={expense.amount} />
                        </span>
                        {expense.paidAmount && expense.paidAmount > 0 && expense.paidAmount < expense.amount && (
                          <span className="text-amber-400 text-xs bg-amber-500/10 px-2 py-1 rounded-lg">
                            Paid: <Currency value={expense.paidAmount} />
                          </span>
                        )}
                      </div>

            {(() => {
              const paidAmount = isPaid ? expense.amount : (expense.paidAmount ?? 0);
              const remaining = Math.max(0, expense.amount - paidAmount);
              return (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex-1">
                    <div className="text-[10px] sm:text-xs text-slate-400">
                      Paid <span className="text-slate-200 font-medium"><Currency value={paidAmount} /></span> · Remaining{" "}
                      <span className="text-slate-200 font-medium"><Currency value={remaining} /></span>
                    </div>
                    <div className="mt-1.5 h-1.5 sm:h-2 w-full rounded-full bg-slate-900/40 border border-white/10 overflow-hidden">
                      <div
                        className={`h-full ${remaining === 0 ? "bg-emerald-500/70" : "bg-purple-500/70"}`}
                        style={{ width: `${Math.min(100, (paidAmount / Math.max(1, expense.amount)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {remaining > 0 && (
                    <div className="w-full">
                      <label className="block">
                        <span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1">Payment amount (£)</span>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={paymentByExpenseId[expense.id] ?? ""}
                            onChange={(e) =>
                              setPaymentByExpenseId((prev) => ({ ...prev, [expense.id]: e.target.value }))
                            }
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-white/10 bg-slate-900/40 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all"
                            placeholder="0.00"
                          />
                          <button
                            type="button"
                            onClick={() => handleApplyPayment(expense.id)}
                            disabled={isPending}
                            className="shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-purple-500/20 text-purple-200 border border-purple-400/30 hover:bg-purple-500/30 transition-all cursor-pointer disabled:opacity-50 text-[10px] sm:text-xs whitespace-nowrap"
                          >
                            Add payment
                          </button>
                        </div>
                      </label>
                  </div>
                  )}
                </div>
              );
            })()}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePaid(expense.id)}
                        disabled={isPending}
                        className={`h-8 sm:h-9 min-w-[76px] sm:min-w-[88px] px-2 sm:px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] flex items-center justify-center gap-1 sm:gap-1.5 ${
                          isPaid
                            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        }`}
                        aria-label={isPaid ? "Mark as unpaid" : "Mark as paid"}
                      >
                        {isPaid ? (
                          <>
                            <Check size={14} className="sm:w-4 sm:h-4" />
                            <span>Paid</span>
                          </>
                        ) : (
                          <span>Unpaid</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditClick(expense)}
                        disabled={isPending}
                        className="h-8 sm:h-9 w-8 sm:w-9 rounded-lg sm:rounded-xl hover:bg-purple-500/20 text-purple-200 transition-all cursor-pointer hover:scale-[1.05] flex items-center justify-center"
                        title="Edit expense"
                      >
                        <Pencil size={14} className="sm:w-4 sm:h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveClick(expense)}
                        disabled={isPending}
                        className="h-8 sm:h-9 w-8 sm:w-9 rounded-lg sm:rounded-xl hover:bg-red-500/20 text-red-400 transition-all cursor-pointer hover:scale-[1.05] flex items-center justify-center"
                        title="Delete expense"
                      >
                        <Trash2 size={14} className="sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {filteredExpenses.length === 0 && !showAddForm && (
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl p-16 text-center border border-white/10">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <span className="text-6xl">📝</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">
            {searchQuery.trim() ? "No matching expenses" : "No expenses yet"}
          </h3>
          <p className="text-slate-400 text-lg mb-6">
            {searchQuery.trim()
              ? "Try a different search term"
              : 'Click "Add Expense" to track your first expense'}
          </p>
          {!searchQuery.trim() && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center justify-center gap-2 text-slate-400 mb-4">
                <TrendingUp size={20} />
                <span className="font-semibold">Pro tip:</span>
              </div>
              <p className="text-slate-300 mb-4">Start by adding your income to get a complete budget overview</p>
              <Link 
                href="/admin/income"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
              >
                <Plus size={20} />
                Add Income First
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
