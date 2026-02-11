"use client";

import { useState } from "react";
import { MONTHS, MonthKey } from "../../../lib/budget/engine";
import ExpenseManager from "./ExpenseManager";

interface ExpensesPageClientProps {
  expenses: Record<string, any[]>;
  categories: any[];
}

const YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];

export default function ExpensesPageClient({ expenses, categories }: ExpensesPageClientProps) {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>("FEBURARY");
  
  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Manage Expenses</h1>
          <p className="text-slate-400">Add and manage your monthly expenses across years</p>
        </div>

        {/* Year + Month Selectors (2-column cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Year Selector */}
          <div className="bg-slate-800/40 rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Select Year</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {YEARS.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`py-4 px-4 rounded-2xl font-bold text-lg transition-all cursor-pointer ${
                    selectedYear === year
                      ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg scale-105"
                      : "bg-slate-900/60 text-slate-300 hover:bg-slate-900/80 hover:shadow-md"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Month Selector */}
          <div className="bg-slate-800/40 rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Select Month</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {MONTHS.map((month) => (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(month as MonthKey)}
                  className={`py-4 px-4 rounded-2xl font-medium transition-all cursor-pointer ${
                    selectedMonth === month
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg scale-105"
                      : "bg-slate-900/60 text-slate-300 hover:bg-slate-900/80 hover:shadow-md"
                  }`}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Period Display */}
        <div className="mb-6 text-center">
          <h3 className="text-2xl font-bold text-white">
            {selectedMonth} {selectedYear}
          </h3>
        </div>

        {/* Expense Manager */}
        <ExpenseManager
          month={selectedMonth}
          year={selectedYear}
          expenses={expenses[selectedMonth] || []}
          categories={categories}
        />
      </div>
    </div>
  );
}
