"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MONTHS } from "@/lib/constants/time";
import { formatMonthKeyLabel, formatMonthKeyShortLabel, normalizeMonthKey } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";
import type { ExpensesByMonth } from "@/types";
import type { CategoryConfig } from "@/lib/categories/store";
import type { EmptyExpensesJumpTarget } from "@/types/expenses-manager";
import type { CreditCardOption } from "@/types/expenses-manager";
import type { DebtOption } from "@/types/expenses-manager";
import ExpenseManager from "./ExpenseManager";
import { HeroCanvasLayoutClient } from "@/components/Shared";

interface BudgetPlan {
  id: string;
  name: string;
  kind: string;
  payDate: number;
	budgetHorizonYears?: number;
}

interface PlanData {
  plan: BudgetPlan;
  expenses: ExpensesByMonth;
	currentYearExpenses?: ExpensesByMonth;
  categories: CategoryConfig[];
	creditCards?: CreditCardOption[];
	debts?: DebtOption[];
}

interface ExpensesPageClientProps {
  allPlansData: PlanData[];
  initialYear: number;
  initialMonth: MonthKey;
	hasAnyIncome: boolean;
	userStartYear: number;
	userStartMonthIndex: number;
}

type TabKey = "personal" | "holiday" | "carnival";

function buildYears(baseYear: number, horizonYears: number): number[] {
  const safe = Number.isFinite(horizonYears) && horizonYears > 0 ? Math.floor(horizonYears) : 10;
  return Array.from({ length: safe }, (_, i) => baseYear + i);
}

function monthIndex(month: MonthKey): number {
  const idx = (MONTHS as unknown as string[]).indexOf(month);
  return idx >= 0 ? idx : 0;
}

function pickNearestMonthWithExpenses(expensesByMonth: ExpensesByMonth | undefined, selectedMonth: MonthKey): MonthKey | null {
  if (!expensesByMonth) return null;
  const selectedIdx = monthIndex(selectedMonth);

  const monthsWithExpenses = (MONTHS as unknown as MonthKey[]).filter(
    (m) => Array.isArray(expensesByMonth[m]) && expensesByMonth[m]!.length > 0
  );
  if (monthsWithExpenses.length === 0) return null;

  const futureOrCurrent = monthsWithExpenses
    .map((m) => ({ m, d: monthIndex(m) - selectedIdx }))
    .filter((x) => x.d >= 0)
    .sort((a, b) => a.d - b.d);
  if (futureOrCurrent.length > 0) return futureOrCurrent[0]!.m;

  const past = monthsWithExpenses
    .map((m) => ({ m, d: selectedIdx - monthIndex(m) }))
    .sort((a, b) => a.d - b.d);
  return past[0]!.m;
}

function kindDisplayLabel(kind: string): string {
  const safe = String(kind ?? "").toLowerCase();
  if (safe === "personal") return "Personal";
  if (safe === "holiday") return "Holiday";
  if (safe === "carnival") return "Carnival";
  return safe ? safe[0]!.toUpperCase() + safe.slice(1) : "Plan";
}



export default function ExpensesPageClient({
  allPlansData,
  initialYear,
  initialMonth,
  hasAnyIncome,
  userStartYear,
  userStartMonthIndex,
}: ExpensesPageClientProps) {
  const planTabsLabelId = useId();
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

  const horizonYearsByPlan = useMemo(() => {
    const map: Record<string, number> = {};
    allPlansData.forEach((d) => {
      const raw = Number(d.plan.budgetHorizonYears ?? 10);
      map[d.plan.id] = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10;
    });
    return map;
  }, [allPlansData]);

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

  const resolvedActiveTab: TabKey = useMemo(() => {
		if (availableTabs.length === 0) return activeTab;
		if (availableTabs.some((t) => t.key === activeTab)) return activeTab;
		return availableTabs[0].key;
	}, [activeTab, availableTabs]);

  // Get plans for active tab
  const activePlans = useMemo(() => {
		return plansByKind[resolvedActiveTab];
	}, [plansByKind, resolvedActiveTab]);

  const kindPlanCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allPlansData.forEach((d) => {
      const kind = String(d.plan.kind ?? "").toLowerCase();
      counts[kind] = (counts[kind] ?? 0) + 1;
    });
    return counts;
  }, [allPlansData]);

  const activeTabHorizonYears = useMemo(() => {
    const first = activePlans[0];
    if (!first) return 10;
    return horizonYearsByPlan[first.plan.id] ?? 10;
  }, [activePlans, horizonYearsByPlan]);

  const YEARS = useMemo(() => buildYears(new Date().getFullYear(), activeTabHorizonYears), [activeTabHorizonYears]);

  // Create categories by plan map
  const allCategoriesByPlan = useMemo(() => {
    const map: Record<string, CategoryConfig[]> = {};
    allPlansData.forEach((data) => {
      map[data.plan.id] = data.categories;
    });
    return map;
  }, [allPlansData]);

	const creditCardsByPlan = useMemo(() => {
		const map: Record<string, CreditCardOption[]> = {};
		allPlansData.forEach((data) => {
			map[data.plan.id] = data.creditCards ?? [];
		});
		return map;
	}, [allPlansData]);

  const debtsByPlan = useMemo(() => {
    const map: Record<string, DebtOption[]> = {};
    allPlansData.forEach((data) => {
      map[data.plan.id] = data.debts ?? [];
    });
    return map;
  }, [allPlansData]);

  const monthsWithAnyExpensesThisYear = useMemo(() => {
    const set = new Set<MonthKey>();
    allPlansData.forEach((d) => {
      (MONTHS as unknown as MonthKey[]).forEach((m) => {
        const list = d.expenses?.[m] ?? [];
        if (Array.isArray(list) && list.length > 0) set.add(m);
      });
    });
    return set;
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

  const globalEmptyJumpTarget = useMemo<EmptyExpensesJumpTarget | null>(() => {
    type Candidate = {
      target: EmptyExpensesJumpTarget;
      yearPenalty: number;
      kindPenalty: number;
      monthDistance: number;
      futurePenalty: number;
    };

    const selectedIdx = monthIndex(selectedMonth);
    const currentYear = new Date().getFullYear();
    const candidates: Candidate[] = [];

    allPlansData.forEach((d) => {
      const kind = String(d.plan.kind ?? "").toLowerCase();
      const kindPenalty = kind === resolvedActiveTab ? 0 : 1;
      const includePlanName = (kindPlanCounts[kind] ?? 0) > 1;
      const planSuffix = includePlanName ? ` (${d.plan.name})` : "";

      const sources: Array<{ year: number; expenses: ExpensesByMonth | undefined; yearPenalty: number }> = [
        { year: selectedYear, expenses: d.expenses, yearPenalty: 0 },
      ];

      if (selectedYear !== currentYear) {
        sources.push({ year: currentYear, expenses: d.currentYearExpenses, yearPenalty: 2 });
      }

      sources.forEach((src) => {
        const m = pickNearestMonthWithExpenses(src.expenses, selectedMonth);
        if (!m) return;
        const idx = monthIndex(m);
        const diff = idx - selectedIdx;
        const futurePenalty = diff >= 0 ? 0 : 1;
        const monthDistance = Math.abs(diff);
        const kindLabel = kindDisplayLabel(kind);
        const monthLabel = formatMonthKeyShortLabel(m);
        candidates.push({
          target: {
            year: src.year,
            month: m,
            tabKey: kind,
            label: `View ${kindLabel} ${monthLabel} Expenses ${src.year}`,
          },
          yearPenalty: src.yearPenalty,
          kindPenalty,
          monthDistance,
          futurePenalty,
        });
      });
    });

    candidates.sort((a, b) => {
      if (a.yearPenalty !== b.yearPenalty) return a.yearPenalty - b.yearPenalty;
      if (a.kindPenalty !== b.kindPenalty) return a.kindPenalty - b.kindPenalty;
      if (a.futurePenalty !== b.futurePenalty) return a.futurePenalty - b.futurePenalty;
      return a.monthDistance - b.monthDistance;
    });

    return candidates[0]?.target ?? null;
  }, [allPlansData, kindPlanCounts, resolvedActiveTab, selectedMonth, selectedYear]);
  
  return (
    <HeroCanvasLayoutClient
      hero={
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Manage Expenses</h1>
          <p className="text-sm sm:text-base text-slate-400">
            Add and manage your monthly expenses across years
          </p>
        </div>
      }
    >
      {/* Year + Month Selectors (Compact on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Year Selector */}
          <div className="bg-slate-800/40 rounded-xl sm:rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl p-2.5 sm:p-5">
            <h2 className="text-xs sm:text-base font-semibold text-white mb-1.5 sm:mb-3">Select Year</h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5 gap-1.5 sm:gap-2">
              {YEARS.map((year) => (
                <button
                  key={year}
                  onClick={() => pushPeriod(selectedMonth, year)}
                  disabled={isNavigating}
                  className={`py-1.5 sm:py-3 px-2 sm:px-3 rounded-md sm:rounded-xl font-bold text-xs sm:text-base transition-all cursor-pointer ${
                    selectedYear === year
                      ? "bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] text-white shadow-lg ring-1 ring-white/15"
                      : "bg-slate-900/60 text-slate-300 hover:bg-slate-900/80 hover:shadow-md"
                  } ${isNavigating ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Month Selector */}
          <div className="bg-slate-800/40 rounded-xl sm:rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl p-2.5 sm:p-5">
            <h2 className="text-xs sm:text-base font-semibold text-white mb-1.5 sm:mb-3">Select Month</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-1.5 sm:gap-2">
              {MONTHS.map((month) => (
                (() => {
						const monthKey = month as MonthKey;
						const idx = monthIndex(monthKey);
						const isBeforeStartYear = selectedYear < userStartYear;
						const isBeforeStartMonth =
							selectedYear === userStartYear && idx >= 0 && idx < userStartMonthIndex;
						const hasExpenses = monthsWithAnyExpensesThisYear.has(monthKey);
						const isLocked = (isBeforeStartYear || isBeforeStartMonth) && !hasExpenses;
						const disabled = isNavigating || isLocked;

						return (
                <button
                  key={month}
                  onClick={() => pushPeriod(monthKey, selectedYear)}
                  disabled={disabled}
                  className={`py-1.5 sm:py-3 px-2 sm:px-3 rounded-md sm:rounded-xl font-semibold text-[11px] sm:text-sm transition-all ${
						disabled
							? "bg-slate-900/30 text-slate-500 cursor-not-allowed opacity-60"
							: selectedMonth === month
								? "bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] text-white shadow-lg ring-1 ring-white/15 cursor-pointer"
								: "bg-slate-900/60 text-slate-300 hover:bg-slate-900/80 hover:shadow-md cursor-pointer"
                  }`}
                  title={isLocked ? "You can’t use months before you signed up (unless you already have expenses there)." : undefined}
                >
				  {formatMonthKeyShortLabel(monthKey)}
                </button>
					);
					})()
              ))}
            </div>
          </div>
        </div>

        {/* Budget Plan Pills - only show if more than one tab */}
        {availableTabs.length > 1 && (
          <div className="mb-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div id={planTabsLabelId} className="text-sm font-medium text-slate-300">
                Budget Plans
              </div>
            <div
              role="tablist"
              aria-labelledby={planTabsLabelId}
              className="inline-flex rounded-full border border-white/10 bg-slate-900/35 backdrop-blur-xl shadow-lg p-1"
            >
              {(() => {
                const activeIndex = Math.max(
                  0,
                  availableTabs.findIndex((t) => t.key === activeTab)
                );
                const tabWidth = 100 / availableTabs.length;

                return (
                  <div className="relative flex items-center w-[320px] max-w-full">
                    <div
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 rounded-full border border-white/10 bg-white shadow-sm transition-transform duration-300 ease-out"
                      style={{
                        width: `${tabWidth}%`,
                        transform: `translateX(${activeIndex * 100}%)`,
                      }}
                    />

                    {availableTabs.map((tab) => {
							const isActive = resolvedActiveTab === tab.key;
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
            </div>
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
				  budgetHorizonYears={horizonYearsByPlan[planData.plan.id] ?? 10}
				  horizonYearsByPlan={horizonYearsByPlan}
              month={selectedMonth}
              year={selectedYear}
              expenses={planData.expenses[selectedMonth] || []}
              categories={planData.categories}
				  creditCards={planData.creditCards ?? []}
				  creditCardsByPlan={creditCardsByPlan}
				  debts={planData.debts ?? []}
				  debtsByPlan={debtsByPlan}
              loading={isNavigating}
              allPlans={allPlansData.map(d => ({ id: d.plan.id, name: d.plan.name, kind: d.plan.kind }))}
              allCategoriesByPlan={allCategoriesByPlan}
              payDate={planData.plan.payDate}
			  hasAnyIncome={hasAnyIncome}
        emptyExpensesJumpTarget={(() => {
        const selectedMonthExpenses = planData.expenses[selectedMonth] ?? [];
        if (selectedMonthExpenses.length > 0) return null;
        const kind = String(planData.plan.kind ?? "").toLowerCase();
        const includePlanName = (kindPlanCounts[kind] ?? 0) > 1;
        const planSuffix = includePlanName ? ` (${planData.plan.name})` : "";

        const m = pickNearestMonthWithExpenses(planData.expenses, selectedMonth);
        if (m) {
          const kindLabel = kindDisplayLabel(kind);
          const monthLabel = formatMonthKeyShortLabel(m);
          return {
            year: selectedYear,
            month: m,
            tabKey: kind,
            label: `View ${kindLabel} ${monthLabel} Expenses ${selectedYear}`,
          } satisfies EmptyExpensesJumpTarget;
        }

        return globalEmptyJumpTarget;
      })()}
        onJumpToEmptyExpensesTarget={(target) => {
        const nextTab = (target.tabKey ?? "") as TabKey;
        if (nextTab === "personal" || nextTab === "holiday" || nextTab === "carnival") {
          setActiveTab(nextTab);
        }
        pushPeriod(target.month, target.year);
        }}
            />
          </div>
        ))}
	</HeroCanvasLayoutClient>
  );
}
