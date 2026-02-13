"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MONTHS } from "@/lib/constants/time";
import { formatMonthKeyLabel, normalizeMonthKey } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";
import type { ExpensesByMonth } from "@/types";
import type { CategoryConfig } from "@/lib/categories/store";
import ExpenseManager from "./ExpenseManager";

interface BudgetPlan {
  id: string;
  name: string;
  kind: string;
}

interface PlanData {
  plan: BudgetPlan;
  expenses: ExpensesByMonth;
  categories: CategoryConfig[];
}

interface ExpensesPageClientProps {
  allPlansData: PlanData[];
  initialYear: number;
  initialMonth: MonthKey;
}

type TabKey = "personal" | "holiday" | "carnival";

function buildYears(baseYear: number): number[] {
	return Array.from({ length: 10 }, (_, i) => baseYear + i);
}



export default function ExpensesPageClient({
  allPlansData,
  initialYear,
  initialMonth,
}: ExpensesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [isNavigating, startTransition] = useTransition();

  // Canonical selected period comes from the URL; we keep optimistic state for immediate UI feedback.
  const urlYear = useMemo(() => {
    const raw = searchParams.get("year");
    const parsed = raw == null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? (parsed as number) : initialYear;
  }, [initialYear, searchParams]);

  const urlMonth = useMemo(() => {
    const raw = searchParams.get("month");
    return (raw && normalizeMonthKey(raw)) ? (normalizeMonthKey(raw) as MonthKey) : initialMonth;
  }, [initialMonth, searchParams]);

  const [optimisticYear, setOptimisticYear] = useState<number>(() => initialYear);
  const [optimisticMonth, setOptimisticMonth] = useState<MonthKey>(() => initialMonth);

  const selectedYear = isNavigating ? optimisticYear : urlYear;
  const selectedMonth = isNavigating ? optimisticMonth : urlMonth;
  
  // Initialize activeTab based on available plans
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    // Check if user has personal plans first
    const hasPersonal = allPlansData.some(d => d.plan.kind.toLowerCase() === "personal");
    if (hasPersonal) return "personal";
    
    // Otherwise check for holiday
    const hasHoliday = allPlansData.some(d => d.plan.kind.toLowerCase() === "holiday");
    if (hasHoliday) return "holiday";
    
    // Otherwise carnival
    return "carnival";
  });

  const YEARS = useMemo(() => buildYears(new Date().getFullYear()), []);

  // Group plans by kind
  const plansByKind = useMemo(() => {
    const grouped: Record<TabKey, PlanData[]> = {
      personal: [],
      holiday: [],
      carnival: [],
    };

    allPlansData.forEach((data) => {
      const kind = data.plan.kind.toLowerCase();
      if (kind === "personal") {
        grouped.personal.push(data);
      } else if (kind === "holiday") {
        grouped.holiday.push(data);
      } else if (kind === "carnival") {
        grouped.carnival.push(data);
      }
    });

    return grouped;
  }, [allPlansData]);

  // Determine which tabs to show
  const availableTabs = useMemo(() => {
    const tabs: Array<{ key: TabKey; label: string }> = [];
    if (plansByKind.personal.length > 0) tabs.push({ key: "personal", label: "Personal" });
    if (plansByKind.holiday.length > 0) tabs.push({ key: "holiday", label: "Holiday" });
    if (plansByKind.carnival.length > 0) tabs.push({ key: "carnival", label: "Carnival" });
    return tabs;
  }, [plansByKind]);

  // Get plans for active tab
  const activePlans = useMemo(() => {
    return plansByKind[activeTab];
  }, [plansByKind, activeTab]);

  // Create categories by plan map
  const allCategoriesByPlan = useMemo(() => {
    const map: Record<string, CategoryConfig[]> = {};
    allPlansData.forEach((data) => {
      map[data.plan.id] = data.categories;
    });
    return map;
  }, [allPlansData]);

  const pushPeriod = (month: MonthKey, year: number) => {
    // Update local state immediately so the UI reflects the chosen period,
    // then navigate and show skeletons until the server render completes.
    setOptimisticMonth(month);
    setOptimisticYear(year);
    const next = new URLSearchParams(searchParams.toString());
    next.set("month", month);
    next.set("year", String(year));
	// Preserve the current (user-scoped) pathname so we stay on the right plan.
	startTransition(() => {
		router.push(`${pathname}?${next.toString()}`);
	});
  };
  
  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-blue-950 via-slate-950 to-black">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Manage Expenses</h1>
          <p className="text-sm sm:text-base text-slate-400">Add and manage your monthly expenses across years</p>
        </div>

        {/* Year + Month Selectors (Compact on mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Year Selector */}
          <div className="bg-slate-800/40 rounded-2xl sm:rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl p-5 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Select Year</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3">
              {YEARS.map((year) => (
                <button
                  key={year}
                  onClick={() => pushPeriod(selectedMonth, year)}
                  disabled={isNavigating}
                  className={`py-3 sm:py-4 px-3 sm:px-4 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg transition-all cursor-pointer ${
                    selectedYear === year
                      ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg scale-105"
                      : "bg-slate-900/60 text-slate-300 hover:bg-slate-900/80 hover:shadow-md"
                  } ${isNavigating ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Month Selector */}
          <div className="bg-slate-800/40 rounded-2xl sm:rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl p-5 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Select Month</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
              {MONTHS.map((month) => (
                <button
                  key={month}
                  onClick={() => pushPeriod(month as MonthKey, selectedYear)}
                  disabled={isNavigating}
                  className={`py-3 sm:py-4 px-3 sm:px-4 rounded-xl sm:rounded-2xl font-medium text-sm sm:text-base transition-all cursor-pointer ${
                    selectedMonth === month
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg scale-105"
                      : "bg-slate-900/60 text-slate-300 hover:bg-slate-900/80 hover:shadow-md"
                  } ${isNavigating ? "opacity-70 cursor-not-allowed" : ""}`}
                >
				  {formatMonthKeyLabel(month as MonthKey).slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Period Display */}
        <div className="mb-4 sm:mb-6 text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-white">
			{formatMonthKeyLabel(selectedMonth)} {selectedYear}
          </h3>
        </div>

        {/* Budget Plan Pills - only show if more than one tab */}
        {availableTabs.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
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

        {/* Expense Managers for active plans */}
        {activePlans.map((planData) => (
          <div key={planData.plan.id} className="mb-8">
            {/* Show plan name if multiple plans under this tab */}
            {activePlans.length > 1 && (
              <h3 className="text-xl font-bold text-white mb-4">{planData.plan.name}</h3>
            )}
            
            <ExpenseManager
              budgetPlanId={planData.plan.id}
              month={selectedMonth}
              year={selectedYear}
              expenses={planData.expenses[selectedMonth] || []}
              categories={planData.categories}
              loading={isNavigating}
              allPlans={allPlansData.map(d => ({ id: d.plan.id, name: d.plan.name, kind: d.plan.kind }))}
              allCategoriesByPlan={allCategoriesByPlan}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
