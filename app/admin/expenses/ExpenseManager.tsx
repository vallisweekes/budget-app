"use client";

import { useState, useTransition, useMemo } from "react";
import { MonthKey } from "../../../lib/budget/engine";
import { addExpenseAction, togglePaidAction, removeExpenseAction } from "./actions";
import { Trash2, Plus, Check, X, ChevronDown, ChevronUp, Search } from "lucide-react";
import CategoryIcon from "../../../components/CategoryIcon";

interface Expense {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
  paidAmount?: number;
  categoryId?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface ExpenseManagerProps {
  month: MonthKey;
  year: number;
  expenses: Expense[];
  categories: Category[];
}

function Currency({ value }: { value: number }) {
  return <span>{value.toLocaleString(undefined, { style: "currency", currency: "GBP" })}</span>;
}

export default function ExpenseManager({ month, year, expenses, categories }: ExpenseManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Toggle category collapse
  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Group expenses by category
  const categoryLookup = categories.reduce((acc, cat) => {
    acc[cat.id] = cat;
    return acc;
  }, {} as Record<string, Category>);

  // Filter expenses by search query
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    
    const query = searchQuery.toLowerCase();
    return expenses.filter(expense => 
      expense.name.toLowerCase().includes(query) ||
      expense.amount.toString().includes(query) ||
      (expense.categoryId && categoryLookup[expense.categoryId]?.name.toLowerCase().includes(query))
    );
  }, [expenses, searchQuery, categoryLookup]);

  const uncategorized = filteredExpenses.filter(e => !e.categoryId);
  const categorized = filteredExpenses.filter(e => e.categoryId);

  const expensesByCategory = categorized.reduce((acc, e) => {
    if (e.categoryId) {
      if (!acc[e.categoryId]) acc[e.categoryId] = [];
      acc[e.categoryId].push(e);
    }
    return acc;
  }, {} as Record<string, Expense[]>);

  const handleTogglePaid = (expenseId: string) => {
    startTransition(() => {
      togglePaidAction(month, expenseId);
    });
  };

  const handleRemove = (expenseId: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      startTransition(() => {
        removeExpenseAction(month, expenseId);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Add Button */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Expenses</h2>
            <p className="text-slate-400 text-sm mt-1">{month} {year}</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl py-3 px-6 font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
          >
            {showAddForm ? <X size={18} /> : <Plus size={18} />}
            {showAddForm ? "Cancel" : "Add Expense"}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search expenses by name, amount, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-800/40 backdrop-blur-xl border border-white/10 text-white placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Add Expense Form */}
      {showAddForm && (
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-white/10">
          <form action={addExpenseAction} className="space-y-6">
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="year" value={year} />
            
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
                <select
                  name="categoryId"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="">None (Uncategorized)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300 mb-2 block">Payment Status</span>
                <select
                  name="paid"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="false">Not Paid</option>
                  <option value="true">Paid</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl py-3 font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all cursor-pointer"
            >
              Add Expense
            </button>
          </form>
        </div>
      )}

      {/* Expenses by Category - Grid Layout */}
      <div className="grid grid-cols-1 gap-6">
        {Object.entries(expensesByCategory).map(([catId, catExpenses]) => {
          const isCollapsed = collapsedCategories[catId];

          return (
            <div key={catId} className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/10 hover:shadow-2xl transition-all">
              {/* Category Header - Clickable to collapse */}
              <button
                onClick={() => toggleCategory(catId)}
                className="w-full p-6 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40 hover:from-slate-900/80 hover:to-slate-900/60 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-2xl shadow-lg`}>
                      <CategoryIcon iconName={category.icon} size={28} className="text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-xl text-white">{category.name}</h3>
                      <p className="text-sm text-slate-400 mt-0.5">{catExpenses.length} {catExpenses.length === 1 ? 'expense' : 'expenses'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        <Currency value={totalAmount} />
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {paidCount} / {catExpenses.length} paid
                      </div>
                    </div>
                    <div className="text-slate-400">
                      {isCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
                    </div>
                  </div>
                </div>
              </button>

              {/* Expenses List - Collapsible */}
              {!isCollapsed && (
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-2xl shadow-lg`}>
                      <CategoryIcon iconName={category.icon} size={28} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-white">{category.name}</h3>
                      <p className="text-sm text-slate-400 mt-0.5">{catExpenses.length} {catExpenses.length === 1 ? 'expense' : 'expenses'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      <Currency value={totalAmount} />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {paidCount} / {catExpenses.length} paid
                    </div>
                  </div>
                </div>
              </div>

              {/* Expenses List */}
              <div className="divide-y divide-white/10">
                {catExpenses.map((expense) => (
                  <div key={expense.id} className="p-5 hover:bg-slate-900/40 transition-all group">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-lg mb-1">{expense.name}</div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-slate-300 font-medium">
                            <Currency value={expense.amount} />
                          </span>
                          {expense.paidAmount && expense.paidAmount > 0 && expense.paidAmount < expense.amount && (
                            <span className="text-amber-400 text-xs bg-amber-500/10 px-2 py-1 rounded-lg">
                              Paid: <Currency value={expense.paidAmount} />
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTogglePaid(expense.id)}
                          disabled={isPending}
                          className={`px-5 py-2.5 rounded-xl font-medium transition-all cursor-pointer shadow-md hover:shadow-lg hover:scale-105 ${
                            expense.paid
                              ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                              : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          }`}
                        >
                          {expense.paid ? <Check size={18} /> : "Unpaid"}
                        </button>

                        <button
                          onClick={() => handleRemove(expense.id)}
                          disabled={isPending}
                          className="p-2.5 rounded-xl hover:bg-red-500/20 text-red-400 transition-all cursor-pointer hover:scale-110"
                          title="Delete expense"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
           button
            onClick={() => toggleCategory('uncategorized')}
            className="w-full p-6 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40 hover:from-slate-900/80 hover:to-slate-900/60 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-600 rounded-2xl shadow-lg">
                  <span className="text-2xl">📋</span>
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-xl text-white">Uncategorized</h3>
                  <p className="text-sm text-slate-400 mt-0.5">{uncategorized.length} {uncategorized.length === 1 ? 'expense' : 'expenses'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold text-white">
                  <Currency value={uncategorized.reduce((sum, e) => sum + e.amount, 0)} />
                </div>
                <div className="text-slate-400">
                  {collapsedCategories['uncategorized'] ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
                </div>
              </div>
            </div>
          </button>

          {!collapsedCategories['uncategorized'] && (
                  <div>
                  <h3 className="font-bold text-xl text-white">Uncategorized</h3>
                  <p className="text-sm text-slate-400 mt-0.5">{uncategorized.length} {uncategorized.length === 1 ? 'expense' : 'expenses'}</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-white">
                <Currency value={uncategorized.reduce((sum, e) => sum + e.amount, 0)} />
              </div>
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {uncategorized.map((expense) => (
              <div key={expense.id} className="p-5 hover:bg-slate-900/40 transition-all group">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-lg mb-1">{expense.name}</div>
                    <div className="text-slate-300 font-medium">
                      <Currency value={expense.amount} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePaid(expense.id)}
                      disabled={isPending}
                      className={`px-5 py-2.5 rounded-xl font-medium transition-all cursor-pointer shadow-md hover:shadow-lg hover:scale-105 ${
                        expense.paid
          )}
                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      }`}
                    >
                      {expense.paid ? <Check size={18} /> : "Unpaid"}
                    </button>

                    <button
                      onClick={() => handleRemove(expense.id)}
                      disabled={isPending}
                      className="p-2.5 rounded-xl hover:bg-red-500/20 text-red-400 transition-all cursor-pointer hover:scale-110"
                      title="Delete expense"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {expenses.length === 0 && !showAddForm && (
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl p-16 text-center border border-white/10">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <span className="text-6xl">📝</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">No expenses yet</h3>
          <p className="text-slate-400 text-lg">Click "Add Expense" to track your first expense</p>
        </div>
      )}
    </div>
  );
}
