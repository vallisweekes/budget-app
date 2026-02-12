"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";
import type { ExpensesByMonth } from "@/types";
import type { CategoryConfig } from "@/lib/categories/store";
import ExpenseManager from "./ExpenseManager";
import { useGetCategoriesQuery, useGetExpensesQuery } from "@/lib/redux/api/bffApi";

interface ExpensesPageClientProps {
  budgetPlanId: string;
  expenses: ExpensesByMonth;
  categories: CategoryConfig[];
  initialYear: number;
  initialMonth: MonthKey;
}

function buildYears(baseYear: number): number[] {
	return Array.from({ length: 10 }, (_, i) => baseYear + i);
}

const monthToNumber: Record<MonthKey, number> = {
  "JANUARY": 1,
  "FEBURARY": 2,
  "MARCH": 3,
  "APRIL": 4,
  "MAY": 5,
  "JUNE": 6,
  "JULY": 7,
  "AUGUST ": 8,
  "SEPTEMBER": 9,
  "OCTOBER": 10,
  "NOVEMBER": 11,
  "DECEMBER": 12,
};

function BackendStatus({ month, year }: { month: MonthKey; year: number }) {
  const monthNumber = monthToNumber[month];
  const categoriesQuery = useGetCategoriesQuery();
  const expensesQuery = useGetExpensesQuery({ month: monthNumber, year });

  const isLoading = categoriesQuery.isLoading || expensesQuery.isLoading;
  const isError = categoriesQuery.isError || expensesQuery.isError;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-xs text-slate-400">Backend (Neon/Prisma):</span>
      {isLoading ? (
        <span className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-slate-900/40 text-slate-200">
          Loading...
        </span>
      ) : isError ? (
        <span className="text-xs px-2 py-1 rounded-lg border border-red-400/20 bg-red-500/10 text-red-200">
          Not connected
        </span>
      ) : (
        <span className="text-xs px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
          Connected
        </span>
      )}

      {!isLoading && !isError && (
        <span className="text-xs text-slate-400">
          {expensesQuery.data?.length ?? 0} expenses · {categoriesQuery.data?.length ?? 0} categories
        </span>
      )}
    </div>
  );
}

export default function ExpensesPageClient({
  budgetPlanId,
  expenses,
  categories,
  initialYear,
  initialMonth,
}: ExpensesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedYear, setSelectedYear] = useState<number>(() => initialYear);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(() => initialMonth);

  const YEARS = useMemo(() => buildYears(new Date().getFullYear()), []);

  useEffect(() => {
    // Keep local state aligned with the URL (server-selected period).
    const rawYear = searchParams.get("year");
    const rawMonth = searchParams.get("month");
    const parsedYear = rawYear == null ? null : Number(rawYear);
    if (Number.isFinite(parsedYear)) setSelectedYear(parsedYear as number);
    if (rawMonth && (MONTHS as string[]).includes(rawMonth)) setSelectedMonth(rawMonth as MonthKey);
  }, [searchParams]);

  const pushPeriod = (month: MonthKey, year: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("plan", budgetPlanId);
    next.set("month", month);
    next.set("year", String(year));
    router.push(`/admin/expenses?${next.toString()}`);
  };
  
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
                  onClick={() => pushPeriod(selectedMonth, year)}
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
                  onClick={() => pushPeriod(month as MonthKey, selectedYear)}
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
          <div className="mt-2">
            <BackendStatus month={selectedMonth} year={selectedYear} />
          </div>
        </div>

        {/* Expense Manager */}
        <ExpenseManager
		  budgetPlanId={budgetPlanId}
          month={selectedMonth}
          year={selectedYear}
          expenses={expenses[selectedMonth] || []}
          categories={categories}
        />
      </div>
    </div>
  );
}
