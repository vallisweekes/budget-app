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
import { usePathname } from "next/navigation";
import PaymentInsightsCards from "@/components/Insights/PaymentInsightsCards";
import PieCategories from "@/components/PieCategories";
import type { PreviousMonthRecap, UpcomingPayment, RecapTip } from "@/lib/expenses/insights";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend,
  type ChartOptions,
  type ScriptableContext,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { LargestExpensesForPlan } from "@/lib/helpers/dashboard/getLargestExpensesByPlan";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend);

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

type TabKey = "personal" | "holiday" | "carnival";

type BudgetPlan = {
  id: string;
  name: string;
  kind: TabKey | string;
  payDate: number;
  budgetHorizonYears?: number;
  createdAt?: string;
};

type BudgetPlanData = {
  categoryData: CategoryDataItem[];
  totalIncome: number;
  totalAllocations: number;
  plannedDebtPayments: number;
  plannedSavingsContribution: number;
  plannedEmergencyContribution: number;
	plannedInvestments: number;
  incomeAfterAllocations: number;
  totalExpenses: number;
  remaining: number;
  goals: GoalLike[];
};

type ViewTabsProps = {
  budgetPlanId: string;
  month: MonthKey;
  categoryData: CategoryDataItem[];
  regularExpenses: ExpenseItem[];
  totalIncome: number;
  totalAllocations: number;
  plannedDebtPayments: number;
  plannedSavingsContribution: number;
  plannedEmergencyContribution: number;
	plannedInvestments: number;
  incomeAfterAllocations: number;
  totalExpenses: number;
  remaining: number;
  debts: DebtItem[];
  totalDebtBalance: number;
  goals: GoalLike[];
  homepageGoalIds?: string[];
  incomeMonthsCoverageByPlan?: Record<string, number>;
  allPlansData?: Record<string, BudgetPlanData>;
	largestExpensesByPlan?: Record<string, LargestExpensesForPlan>;
  expenseInsights?: {
    recap: PreviousMonthRecap;
    upcoming: UpcomingPayment[];
    recapTips?: RecapTip[];
  };
};

type GoalsSubTabKey = "overview" | "projection";

type MonthlyAssumptions = {
  savings: number;
  emergency: number;
  investments: number;
};

type MonthlyAssumptionsDraft = {
	savings: string;
	emergency: string;
  investments: string;
};

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

function formatCurrencyCompact(value: number): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(Math.round(value));
  } catch {
    return formatCurrency(Math.round(value));
  }
}

function formatCurrencyWhole(value: number): string {
	try {
		return new Intl.NumberFormat("en-GB", {
			style: "currency",
			currency: "GBP",
			maximumFractionDigits: 0,
			minimumFractionDigits: 0,
		}).format(Math.round(value));
	} catch {
		return formatCurrency(Math.round(value));
	}
}

function monthDisplayLabel(month: MonthKey): string {
  const raw = formatMonthKeyLabel(month).trim();
  return raw.length ? raw[0] + raw.slice(1).toLowerCase() : raw;
}

function percent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(0)}%`;
}

function buildScopedPageHref(pathname: string | null, page: string): string {
  if (!pathname) return `/admin/${page}`;
  const idx = pathname.lastIndexOf("/page=");
  if (idx >= 0) return `${pathname.slice(0, idx)}/page=${page}`;

  const segments = pathname.split("/").filter(Boolean);
  const userIdx = segments.findIndex((s) => s.startsWith("user="));
  if (userIdx !== -1 && segments.length >= userIdx + 2) {
    const base = `/${segments[userIdx]}/${segments[userIdx + 1]}`;
    return `${base}/page=${page}`;
  }

  return `/admin/${page}`;
}

function buildScopedPageHrefForPlan(pathname: string | null, budgetPlanId: string, page: string): string {
  if (!pathname) return `/admin/${page}`;
  const segments = pathname.split("/").filter(Boolean);
  const userIdx = segments.findIndex((s) => s.startsWith("user="));
  if (userIdx !== -1) {
    const userSegment = segments[userIdx];
    return `/${userSegment}/${encodeURIComponent(budgetPlanId)}/page=${page}`;
  }
  return buildScopedPageHref(pathname, page);
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
	plannedEmergencyContribution,
	plannedInvestments,
  incomeAfterAllocations,
  totalExpenses,
  remaining,
  goals,
  homepageGoalIds: initialHomepageGoalIds,
  incomeMonthsCoverageByPlan,
  allPlansData,
  largestExpensesByPlan,
	expenseInsights,
}: ViewTabsProps) {
  const pathname = usePathname();
	const expensesHref = useMemo(() => buildScopedPageHref(pathname, "expenses"), [pathname]);
	const incomeHref = useMemo(() => buildScopedPageHref(pathname, "income"), [pathname]);

  const planTabsLabelId = useId();
  const [budgetPlans, setBudgetPlans] = useState<BudgetPlan[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
	const [goalsSubTab, setGoalsSubTab] = useState<GoalsSubTabKey>("overview");

  const homepageGoalIds = useMemo(
    () => (Array.isArray(initialHomepageGoalIds) ? initialHomepageGoalIds.slice(0, 2) : []),
    [initialHomepageGoalIds]
  );

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
				const rawHorizon = (p as unknown as { budgetHorizonYears?: unknown }).budgetHorizonYears;
				const parsedHorizon = typeof rawHorizon === "number" ? rawHorizon : Number(rawHorizon);
            return {
              ...p,
              payDate: Number.isFinite(parsedPayDate) && parsedPayDate > 0 ? parsedPayDate : 27,
				budgetHorizonYears: Number.isFinite(parsedHorizon) && parsedHorizon > 0 ? parsedHorizon : undefined,
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

  const resolvedActiveTab = useMemo<TabKey>(() => {
    if (availableTabs.length === 0) return activeTab;
    if (availableTabs.some((t) => t.key === activeTab)) return activeTab;
    return availableTabs[0].key;
  }, [activeTab, availableTabs]);

  // Get plans for active tab
  const activePlans = plansByKind[resolvedActiveTab];

  const shouldShowAddIncome = useMemo(() => {
    if (!incomeMonthsCoverageByPlan) return true;
    const ids = activePlans.length > 0 ? activePlans.map((p) => p.id) : [budgetPlanId];
    // Show the shortcut if any active plan is missing income for some month.
    return ids.some((id) => (incomeMonthsCoverageByPlan[id] ?? 0) < 12);
  }, [activePlans, budgetPlanId, incomeMonthsCoverageByPlan]);

  const fallbackPlanData = useMemo(() => {
    const fromAllPlans = allPlansData?.[budgetPlanId];
    if (fromAllPlans) return fromAllPlans;

    return {
      categoryData,
      totalIncome,
      totalAllocations,
      plannedDebtPayments,
      plannedSavingsContribution,
      plannedEmergencyContribution,
		plannedInvestments,
      incomeAfterAllocations,
      totalExpenses,
      remaining,
      goals,
    };
  }, [allPlansData, budgetPlanId, categoryData, goals, incomeAfterAllocations, plannedDebtPayments, plannedEmergencyContribution, plannedInvestments, plannedSavingsContribution, remaining, totalAllocations, totalExpenses, totalIncome]);

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
        plannedEmergencyContribution: fallbackPlanData.plannedEmergencyContribution ?? 0,
		plannedInvestments: fallbackPlanData.plannedInvestments ?? 0,
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
    let plannedEmergencyTotal = 0;
  	let plannedInvestmentsTotal = 0;
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
      plannedEmergencyTotal += planData.plannedEmergencyContribution ?? 0;
		plannedInvestmentsTotal += planData.plannedInvestments ?? 0;
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
      plannedEmergencyContribution: plannedEmergencyTotal,
		plannedInvestments: plannedInvestmentsTotal,
      categoryTotals: Object.entries(categoryTotals).map(([name, v]) => ({
        name,
        total: v.total,
        color: v.color,
      })),
      goals: combinedGoals,
      flattenedExpenses,
    };
  }, [activePlans, allPlansData, fallbackPlanData]);

  const activePlansMeta = useMemo(() => {
    if (budgetPlans.length === 0) return [];
    const ids = new Set((activePlans.length > 0 ? activePlans : [{ id: budgetPlanId }]).map((p) => p.id));
    return budgetPlans.filter((p) => ids.has(p.id));
  }, [activePlans, budgetPlanId, budgetPlans]);

  const projectionHorizonYears = useMemo(() => {
    const horizons = activePlansMeta
      .map((p) => (typeof p.budgetHorizonYears === "number" ? p.budgetHorizonYears : undefined))
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
    if (horizons.length === 0) return 10;
    return Math.max(...horizons);
  }, [activePlansMeta]);

  const defaultMonthlySavings = combinedData.plannedSavingsContribution ?? 0;
  const defaultMonthlyEmergency = combinedData.plannedEmergencyContribution ?? 0;
	const defaultMonthlyInvestments = combinedData.plannedInvestments ?? 0;

  const savingsAssumptionNow = useMemo(() => {
    const n = Number(defaultMonthlySavings);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }, [defaultMonthlySavings]);

  const emergencyAssumptionNow = useMemo(() => {
    const n = Number(defaultMonthlyEmergency);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }, [defaultMonthlyEmergency]);

	const investmentsAssumptionNow = useMemo(() => {
		const n = Number(defaultMonthlyInvestments);
		return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
	}, [defaultMonthlyInvestments]);

  const [assumptionsByTab, setAssumptionsByTab] = useState<Partial<Record<TabKey, MonthlyAssumptions>>>({});
	const [assumptionDraftsByTab, setAssumptionDraftsByTab] =
		useState<Partial<Record<TabKey, MonthlyAssumptionsDraft>>>({});

  const monthlyAssumptions = useMemo<MonthlyAssumptions>(() => {
    const existing = assumptionsByTab[resolvedActiveTab];
    if (existing) {
      return {
        savings: existing.savings,
        emergency: existing.emergency,
			investments:
				typeof existing.investments === "number" && Number.isFinite(existing.investments)
					? existing.investments
					: defaultMonthlyInvestments,
      };
    }
    return {
      savings: defaultMonthlySavings,
      emergency: defaultMonthlyEmergency,
		investments: defaultMonthlyInvestments,
    };
  }, [assumptionsByTab, defaultMonthlyEmergency, defaultMonthlyInvestments, defaultMonthlySavings, resolvedActiveTab]);

  const monthlyAssumptionsDraft = useMemo<MonthlyAssumptionsDraft>(() => {
    const existing = assumptionDraftsByTab[resolvedActiveTab];
    if (existing) {
			return {
				savings: existing.savings,
				emergency: existing.emergency,
				investments: typeof existing.investments === "string" ? existing.investments : "0",
			};
		}
    return {
      savings: String(Number.isFinite(monthlyAssumptions.savings) ? monthlyAssumptions.savings : 0),
      emergency: String(Number.isFinite(monthlyAssumptions.emergency) ? monthlyAssumptions.emergency : 0),
		investments: String(Number.isFinite(monthlyAssumptions.investments) ? monthlyAssumptions.investments : 0),
    };
  }, [assumptionDraftsByTab, monthlyAssumptions.emergency, monthlyAssumptions.investments, monthlyAssumptions.savings, resolvedActiveTab]);

  useEffect(() => {
    setAssumptionDraftsByTab((prev) => {
			const existing = prev[resolvedActiveTab];
			if (existing && typeof existing.investments === "string") return prev;
      return {
        ...prev,
        [resolvedActiveTab]: {
				savings: existing?.savings ?? String(Number.isFinite(monthlyAssumptions.savings) ? monthlyAssumptions.savings : 0),
				emergency: existing?.emergency ?? String(Number.isFinite(monthlyAssumptions.emergency) ? monthlyAssumptions.emergency : 0),
			investments: String(Number.isFinite(monthlyAssumptions.investments) ? monthlyAssumptions.investments : 0),
        },
      };
    });
  }, [monthlyAssumptions.emergency, monthlyAssumptions.investments, monthlyAssumptions.savings, resolvedActiveTab]);

  const goalsProjection = useMemo(() => {
    const monthlySavings = Math.max(0, monthlyAssumptions.savings);
    const monthlyEmergency = Math.max(0, monthlyAssumptions.emergency);
		const monthlyInvestments = Math.max(0, monthlyAssumptions.investments);

    const startingSavings = combinedData.goals
      .filter((g) => g.category === "savings")
      .reduce((sum, g) => sum + (g.currentAmount ?? 0), 0);
    const startingEmergency = combinedData.goals
      .filter((g) => g.category === "emergency")
      .reduce((sum, g) => sum + (g.currentAmount ?? 0), 0);

		const startingInvestments = combinedData.goals
			.filter((g) => g.category === "investment")
			.reduce((sum, g) => sum + (g.currentAmount ?? 0), 0);

    const monthsToProject = Math.max(1, Math.min(12 * projectionHorizonYears, 12 * 30));
    let savings = startingSavings;
    let emergency = startingEmergency;
		let investments = startingInvestments;
    const points: Array<{ t: number; savings: number; emergency: number; investments: number; total: number }> = [
      { t: 0, savings, emergency, investments, total: savings + emergency + investments },
    ];

    for (let i = 1; i <= monthsToProject; i += 1) {
      savings += monthlySavings;
      emergency += monthlyEmergency;
			investments += monthlyInvestments;
      points.push({ t: i, savings, emergency, investments, total: savings + emergency + investments });
    }

    return {
      startingSavings,
      startingEmergency,
		startingInvestments,
      monthlySavings,
      monthlyEmergency,
		monthlyInvestments,
      points,
    };
  }, [combinedData.goals, monthlyAssumptions.emergency, monthlyAssumptions.investments, monthlyAssumptions.savings, projectionHorizonYears]);

  const eligibleHomepageGoals = useMemo(() => {
    return combinedData.goals;
  }, [combinedData.goals]);

  const homepageGoalsForOverview = useMemo(() => {
    const byId = new Map<string, GoalLike>();
    eligibleHomepageGoals.forEach((g) => byId.set(g.id, g));

    const picked = homepageGoalIds
      .filter((id) => byId.has(id))
      .map((id) => byId.get(id)!)
      .slice(0, 2);
    if (picked.length > 0) return picked;

    const emergency = eligibleHomepageGoals.find((g) => g.category === "emergency");
    const savings = eligibleHomepageGoals.find((g) => g.category === "savings");
    const defaults: GoalLike[] = [];
    if (emergency) defaults.push(emergency);
    if (savings && savings.id !== emergency?.id) defaults.push(savings);
    if (defaults.length > 0) return defaults.slice(0, 2);
    return eligibleHomepageGoals.slice(0, 2);
  }, [eligibleHomepageGoals, homepageGoalIds]);

  const goalsOverviewCount = useMemo(() => {
    return combinedData.goals.length;
  }, [combinedData.goals]);

  const shouldShowGoalsCard = useMemo(() => {
    const hasGoals = goalsOverviewCount > 0;
    const hasProjectionSignal =
      goalsProjection.startingSavings > 0 ||
      goalsProjection.startingEmergency > 0 ||
			goalsProjection.startingInvestments > 0 ||
      goalsProjection.monthlySavings > 0 ||
			goalsProjection.monthlyEmergency > 0 ||
			goalsProjection.monthlyInvestments > 0;
    return hasGoals || hasProjectionSignal;
  }, [goalsOverviewCount, goalsProjection.monthlyEmergency, goalsProjection.monthlyInvestments, goalsProjection.monthlySavings, goalsProjection.startingEmergency, goalsProjection.startingInvestments, goalsProjection.startingSavings]);

  const setSavingsAssumption = (raw: string) => {
    setAssumptionDraftsByTab((prev) => {
			const existing = prev[resolvedActiveTab] ?? {
				savings: String(Number.isFinite(monthlyAssumptions.savings) ? monthlyAssumptions.savings : 0),
				emergency: String(Number.isFinite(monthlyAssumptions.emergency) ? monthlyAssumptions.emergency : 0),
        investments: String(Number.isFinite(monthlyAssumptions.investments) ? monthlyAssumptions.investments : 0),
			};
      return {
        ...prev,
        [resolvedActiveTab]: {
				...existing,
          savings: raw,
        },
      };
    });

    const next = raw.trim() === "" ? 0 : Number.parseInt(raw, 10);
    const value = Number.isFinite(next) ? Math.max(0, next) : 0;
    setAssumptionsByTab((prev) => {
      return {
        ...prev,
        [resolvedActiveTab]: {
          savings: value,
          emergency: prev[resolvedActiveTab]?.emergency ?? defaultMonthlyEmergency,
          investments: prev[resolvedActiveTab]?.investments ?? defaultMonthlyInvestments,
        },
      };
    });
  };

  const setEmergencyAssumption = (raw: string) => {
    setAssumptionDraftsByTab((prev) => {
			const existing = prev[resolvedActiveTab] ?? {
				savings: String(Number.isFinite(monthlyAssumptions.savings) ? monthlyAssumptions.savings : 0),
				emergency: String(Number.isFinite(monthlyAssumptions.emergency) ? monthlyAssumptions.emergency : 0),
        investments: String(Number.isFinite(monthlyAssumptions.investments) ? monthlyAssumptions.investments : 0),
			};
      return {
        ...prev,
        [resolvedActiveTab]: {
				...existing,
          emergency: raw,
        },
      };
    });

    const next = raw.trim() === "" ? 0 : Number.parseInt(raw, 10);
    const value = Number.isFinite(next) ? Math.max(0, next) : 0;
    setAssumptionsByTab((prev) => {
      return {
        ...prev,
        [resolvedActiveTab]: {
          savings: prev[resolvedActiveTab]?.savings ?? defaultMonthlySavings,
          emergency: value,
          investments: prev[resolvedActiveTab]?.investments ?? defaultMonthlyInvestments,
        },
      };
    });
  };

  const setInvestmentsAssumption = (raw: string) => {
    setAssumptionDraftsByTab((prev) => {
      const existing = prev[resolvedActiveTab] ?? {
        savings: String(Number.isFinite(monthlyAssumptions.savings) ? monthlyAssumptions.savings : 0),
        emergency: String(Number.isFinite(monthlyAssumptions.emergency) ? monthlyAssumptions.emergency : 0),
        investments: String(Number.isFinite(monthlyAssumptions.investments) ? monthlyAssumptions.investments : 0),
      };
      return {
        ...prev,
        [resolvedActiveTab]: {
          ...existing,
          investments: raw,
        },
      };
    });

    const next = raw.trim() === "" ? 0 : Number.parseInt(raw, 10);
    const value = Number.isFinite(next) ? Math.max(0, next) : 0;
    setAssumptionsByTab((prev) => {
      return {
        ...prev,
        [resolvedActiveTab]: {
          savings: prev[resolvedActiveTab]?.savings ?? defaultMonthlySavings,
          emergency: prev[resolvedActiveTab]?.emergency ?? defaultMonthlyEmergency,
          investments: value,
        },
      };
    });
  };

	const clearAssumptionZeroOnFocus = (field: keyof MonthlyAssumptionsDraft) => {
		setAssumptionDraftsByTab((prev) => {
			const existing = prev[resolvedActiveTab] ?? monthlyAssumptionsDraft;
			if (existing[field] !== "0") return prev;
			return {
				...prev,
				[resolvedActiveTab]: {
					...existing,
					[field]: "",
				},
			};
		});
	};

	const normalizeAssumptionOnBlur = (field: keyof MonthlyAssumptionsDraft) => {
		setAssumptionDraftsByTab((prev) => {
			const existing = prev[resolvedActiveTab] ?? monthlyAssumptionsDraft;
			if (existing[field].trim() !== "") return prev;
			return {
				...prev,
				[resolvedActiveTab]: {
					...existing,
					[field]: "0",
				},
			};
		});
	};

  const resetProjectionAssumptionsToNow = () => {
    setAssumptionsByTab((prev) => {
      return {
        ...prev,
        [resolvedActiveTab]: {
          savings: savingsAssumptionNow,
          emergency: emergencyAssumptionNow,
			investments: investmentsAssumptionNow,
        },
      };
    });
    setAssumptionDraftsByTab((prev) => {
      return {
        ...prev,
        [resolvedActiveTab]: {
          savings: String(savingsAssumptionNow),
          emergency: String(emergencyAssumptionNow),
			investments: String(investmentsAssumptionNow),
        },
      };
    });
  };

  const canResetProjectionAssumptions =
    monthlyAssumptions.savings !== savingsAssumptionNow ||
    monthlyAssumptions.emergency !== emergencyAssumptionNow ||
    monthlyAssumptions.investments !== investmentsAssumptionNow;

  const projectionChart = useMemo(() => {
    const pts = goalsProjection.points;
    if (pts.length < 2) return null;

    const chartPts = pts;
    const baseYear = new Date().getFullYear();

    const savingsSeries = chartPts.map((p) => ({ x: p.t, y: p.savings }));
    const emergencySeries = chartPts.map((p) => ({ x: p.t, y: p.emergency }));
		const investmentsSeries = chartPts.map((p) => ({ x: p.t, y: p.investments }));

    const maxVal = Math.max(...pts.map((p) => Math.max(p.savings, p.emergency, p.investments)), 1);
    const suggestedMax = Math.ceil(maxVal / 1000) * 1000;

    const data = {
      datasets: [
        {
          label: "Savings",
          data: savingsSeries,
          borderColor: "rgba(52, 211, 153, 0.95)",
          backgroundColor: "rgba(52, 211, 153, 0.18)",
          fill: true,
          tension: 0.2,
          borderWidth: 4,
				pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === chartPts.length - 1 ? 4 : 0),
          pointHoverRadius: 5,
        },
        {
          label: "Emergency",
          data: emergencySeries,
          borderColor: "rgba(56, 189, 248, 0.95)",
          backgroundColor: "rgba(56, 189, 248, 0.14)",
          fill: true,
          tension: 0.2,
          borderWidth: 4,
				pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === chartPts.length - 1 ? 4 : 0),
          pointHoverRadius: 5,
        },
			{
				label: "Investments",
				data: investmentsSeries,
				borderColor: "rgba(167, 139, 250, 0.95)",
				backgroundColor: "rgba(167, 139, 250, 0.12)",
				fill: true,
				tension: 0.2,
				borderWidth: 4,
				pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === chartPts.length - 1 ? 4 : 0),
				pointHoverRadius: 5,
			},
      ],
    };

    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          mode: "index",
          intersect: false,
          callbacks: {
            title: (items) => {
              const t = Number(items?.[0]?.parsed?.x ?? 0);
              if (t <= 0) return String(baseYear);
              const years = Math.floor(t / 12);
              const months = t % 12;
              if (years <= 0) return `+${t}m`;
              if (months === 0) return `+${years}y`;
              return `+${years}y ${months}m`;
            },
            label: (item) => `${item.dataset.label}: ${formatCurrencyWhole(item.parsed.y ?? 0)}`,
          },
        },
      },
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          type: "linear",
          grid: { display: false },
          ticks: {
            color: "rgba(226, 232, 240, 0.6)",
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
				stepSize: 12,
            maxTicksLimit: 7,
            autoSkipPadding: 28,
				callback: (val) => String(baseYear + Math.floor(Number(val) / 12)),
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax,
          grid: { color: "rgba(255,255,255,0.10)" },
          ticks: {
            color: "rgba(226, 232, 240, 0.65)",
            callback: (val) => formatCurrencyCompact(Number(val)),
          },
        },
      },
    };

    return { data, options, maxVal: suggestedMax };
  }, [goalsProjection.points]);

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

  type LargestExpenseSection = {
    key: "personal" | "carnival" | "holiday";
    label: string;
    items: Array<{ id: string; name: string; amount: number }>;
  };

  const largestExpensesCard = useMemo(() => {
    const planCount = budgetPlans.length > 0 ? budgetPlans.length : Object.keys(allPlansData ?? {}).length;
    const hasEventPlans =
      budgetPlans.length > 0
        ? budgetPlans.some((p) => String(p.kind).toLowerCase() === "carnival" || String(p.kind).toLowerCase() === "holiday")
        : Object.values(allPlansData ?? {}).some((p) => (p as any)?.kind === "carnival" || (p as any)?.kind === "holiday");

    const isSinglePlan = !planCount || planCount <= 1;
    const shouldShowGrouped = !isSinglePlan && hasEventPlans && budgetPlans.length > 0;

    const title = shouldShowGrouped ? "Largest expenses (by plan)" : "Largest expenses";
    if (!shouldShowGrouped) {
      return {
        title,
        sections: [] as LargestExpenseSection[],
        flat: largestExpenses,
        showEventDivider: false,
      };
    }

    const byKindLatest = (kind: "personal" | "carnival" | "holiday") => {
      const filtered = budgetPlans
        .filter((p) => String(p.kind).toLowerCase() === kind)
        .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
      return filtered[0] ?? null;
    };

    const personalPlan = byKindLatest("personal");
    const carnivalPlan = byKindLatest("carnival");
    const holidayPlan = byKindLatest("holiday");

    const getTopExpenses = (planId: string, limit: number) => {
      const byPlan = largestExpensesByPlan?.[planId];
      if (byPlan && Array.isArray(byPlan.items)) {
        return byPlan.items.slice(0, limit);
      }

      // Fallback: current-month dashboard data (may be empty for event plans).
      const planData = allPlansData?.[planId];
      if (!planData) return [] as Array<{ id: string; name: string; amount: number }>;
      const flat = (planData.categoryData ?? []).flatMap((c) => c.expenses ?? []);
      return [...flat]
        .map((e) => ({ id: e.id, name: e.name, amount: Number(e.amount) }))
        .filter((e) => Number.isFinite(e.amount) && e.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);
    };

    const perPlanMax = 3;
    const carnivalItems = carnivalPlan ? getTopExpenses(carnivalPlan.id, perPlanMax) : [];
    const holidayItems = holidayPlan ? getTopExpenses(holidayPlan.id, perPlanMax) : [];
    const personalItems = personalPlan ? getTopExpenses(personalPlan.id, perPlanMax) : [];

    const sections: LargestExpenseSection[] = [];
    if (personalPlan && personalItems.length > 0) {
      sections.push({ key: "personal", label: "Personal", items: personalItems });
    }
    if (carnivalPlan && carnivalItems.length > 0) {
      sections.push({ key: "carnival", label: "Carnival", items: carnivalItems });
    }
    if (holidayPlan && holidayItems.length > 0) {
      sections.push({ key: "holiday", label: "Holiday", items: holidayItems });
    }

    return {
      title,
      sections,
      flat: [] as Array<{ id: string; name: string; amount: number }>,
      showEventDivider: Boolean(carnivalPlan && holidayPlan),
    };
  }, [allPlansData, budgetPlans, largestExpenses]);

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
                  availableTabs.findIndex((t) => t.key === resolvedActiveTab)
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
            </>
          )}

          <Link
            href={expensesHref}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
          >
            <Plus size={16} />
            Add expense
          </Link>
          {shouldShowAddIncome ? (
            <Link
              href={incomeHref}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
            >
              <Plus size={16} />
              Add income
            </Link>
          ) : null}
        </div>
      </div>

		{combinedData.totalIncome <= 0 ? (
			<div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<div className="text-sm font-semibold text-white">Add income to unlock your budget</div>
					<div className="text-xs sm:text-sm text-amber-100/80">
						No income added for {monthDisplayLabel(month)} yet — your totals and insights will be limited until you do.
					</div>
				</div>
				<Link
					href={incomeHref}
					className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
				>
					Add income
				</Link>
			</div>
		) : null}

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
			<div className="mt-2">
				<Link
					href={incomeHref}
					className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/85 hover:text-white"
				>
					<Plus size={14} />
					{shouldShowAddIncome ? "Add income" : "View income"}
				</Link>
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
              <Link href={expensesHref} className="text-sm font-medium text-white/90 hover:text-white">
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
          {largestExpensesCard.title}
              </div>
            </div>

      {largestExpensesCard.sections.length > 0 ? (
        <div className="space-y-3">
          {largestExpensesCard.sections.map((section, idx) => {
            const prev = largestExpensesCard.sections[idx - 1];
            const shouldDividerBetweenEventPlans =
              largestExpensesCard.showEventDivider &&
              prev &&
              ((prev.key === "carnival" && section.key === "holiday") ||
                (prev.key === "holiday" && section.key === "carnival"));
            return (
              <div key={section.key} className="space-y-2">
                {shouldDividerBetweenEventPlans ? <div className="h-px bg-white/10" /> : null}
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {section.label}
                </div>
                {section.items.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white truncate">{e.name}</div>
                    <div className="text-sm text-slate-200 whitespace-nowrap">
                      <Currency value={e.amount} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : largestExpensesCard.flat.length === 0 ? (
        <div className="text-sm text-slate-300">No expenses yet for this month.</div>
      ) : (
        <div className="space-y-2">
          {largestExpensesCard.flat.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3">
              <div className="text-sm text-white truncate">{e.name}</div>
              <div className="text-sm text-slate-200 whitespace-nowrap">
                <Currency value={e.amount} />
              </div>
            </div>
          ))}
        </div>
      )}

            <div className="grid grid-cols-2 gap-2">
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  Debt
                  <InfoTooltip
                    ariaLabel="Debt total info"
                    content="Sum of your current outstanding debt balances for this plan (excluding fully paid debts)."
                  />
                </span>
              }
              className="p-3 bg-white/5"
            >
              <div className="text-base font-bold"><Currency value={totalDebtBalance} /></div>
              <div className="text-xs text-slate-300">this plan</div>
            </Card>
            <Card
              title={
                <span className="inline-flex items-center gap-1.5">
                  Goals
                  <InfoTooltip
                    ariaLabel="Goals count info"
                    content="Number of active goals on this plan (excluding the special 'Pay Back Debts' goal)."
                  />
                </span>
              }
              className="p-3 bg-white/5"
            >
              <div className="text-base font-bold">{combinedData.goals.length}</div>
              <div className="text-xs text-slate-300">active</div>
            </Card>
            </div>
          </div>
        </Card>
      </div>

      {shouldShowGoalsCard ? (
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
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setGoalsSubTab("overview")}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
              goalsSubTab === "overview" ? "bg-white text-slate-900" : "text-slate-200 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setGoalsSubTab("projection")}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
              goalsSubTab === "projection" ? "bg-white text-slate-900" : "text-slate-200 hover:text-white"
            }`}
          >
            Projection
          </button>
        </div>

      <div className="inline-flex items-center gap-2">
        {goalsSubTab === "projection" ? (
          <button
            type="button"
            onClick={resetProjectionAssumptionsToNow}
            disabled={!canResetProjectionAssumptions}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition border ${
              canResetProjectionAssumptions
                ? "border-white/15 bg-white/10 text-white hover:bg-white/15"
                : "border-white/10 bg-white/5 text-white/50 cursor-not-allowed"
            }`}
            aria-label="Reset projection assumptions to now"
            title="Reset Savings/Emergency assumptions back to your current plan values"
          >
            Reset to now
          </button>
        ) : null}

        <div className="text-xs text-slate-400 inline-flex items-center gap-1.5">
          <span>{projectionHorizonYears}y</span>
          <InfoTooltip
            ariaLabel="Projection info"
            content="Projection uses your monthly assumptions for Savings/Emergency (per month) starting from the current month. Horizon uses the longest budget horizon across the selected budget(s)."
          />
        </div>
      </div>
      </div>

      {goalsSubTab === "overview" ? (
        <div
          className={`grid grid-cols-1 ${homepageGoalsForOverview.length === 1 ? "md:grid-cols-1" : "md:grid-cols-2"} gap-3`}
        >
          {homepageGoalsForOverview.map((g) => {
              const target = g.targetAmount ?? 0;
              const current = g.currentAmount ?? 0;
              const progress = target > 0 ? Math.min(1, current / target) : 0;
              return (
                <div key={g.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="font-semibold text-white truncate">{g.title}</div>
                  {target > 0 ? (
                    <>
                      <div className="mt-2 flex items-center justify-between text-sm text-slate-200">
                        <span>
                          <Currency value={current} />
                        </span>
                        <span>
                          <Currency value={target} />
                        </span>
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
			{homepageGoalsForOverview.length === 0 ? (
				<div className="text-sm text-slate-300">Add a target amount to a goal to show it here.</div>
			) : null}
        </div>
      ) : (
        <div className="space-y-3">
    			<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Card
              title={
                <div className="inline-flex items-center gap-1.5">
                  <span>Savings</span>
                  <InfoTooltip
                    ariaLabel="Savings projection info"
                    content="Savings projection starts from your current Savings goal amount and adds your monthly Savings assumption each month."
                  />
                </div>
              }
              className="p-3 bg-white/5"
            >
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-slate-300">Now</div>
              <div className="text-base font-bold text-white">
                {formatCurrencyWhole(goalsProjection.startingSavings)}
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-300">Assumption</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                value={monthlyAssumptionsDraft.savings}
					placeholder="0"
					onFocus={() => clearAssumptionZeroOnFocus("savings")}
					onBlur={() => normalizeAssumptionOnBlur("savings")}
                onChange={(e) => setSavingsAssumption(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                aria-label="Monthly savings assumption"
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">/ month</span>
            </div>
          </div>
        </div>
            </Card>
            <Card
              title={
                <div className="inline-flex items-center gap-1.5">
                  <span>Emergency</span>
                  <InfoTooltip
                    ariaLabel="Emergency projection info"
                    content="Emergency projection starts from your current Emergency fund goal amount and adds your monthly Emergency assumption each month."
                  />
                </div>
              }
              className="p-3 bg-white/5"
            >
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-slate-300">Now</div>
              <div className="text-base font-bold text-white">
                {formatCurrencyWhole(goalsProjection.startingEmergency)}
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-300">Assumption</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                value={monthlyAssumptionsDraft.emergency}
					placeholder="0"
					onFocus={() => clearAssumptionZeroOnFocus("emergency")}
					onBlur={() => normalizeAssumptionOnBlur("emergency")}
                onChange={(e) => setEmergencyAssumption(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                aria-label="Monthly emergency assumption"
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">/ month</span>
            </div>
          </div>
        </div>
            </Card>
        <Card
          title={
            <div className="inline-flex items-center gap-1.5">
              <span>Investments</span>
              <InfoTooltip
                ariaLabel="Investments projection info"
                content="Investments projection starts from your current Investment goal amount and adds your monthly Investments assumption each month."
              />
            </div>
          }
          className="p-3 bg-white/5"
        >
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-300">Now</div>
                <div className="text-base font-bold text-white">
                  {formatCurrencyWhole(goalsProjection.startingInvestments)}
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-300">Assumption</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50}
                  value={monthlyAssumptionsDraft.investments}
                  placeholder="0"
                  onFocus={() => clearAssumptionZeroOnFocus("investments")}
                  onBlur={() => normalizeAssumptionOnBlur("investments")}
                  onChange={(e) => setInvestmentsAssumption(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                  aria-label="Monthly investments assumption"
                />
                <span className="text-xs text-slate-400 whitespace-nowrap">/ month</span>
              </div>
            </div>
          </div>
        </Card>
          </div>

          {projectionChart ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Over time</div>
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Savings
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-sky-400" /> Emergency
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-violet-400" /> Investments
                  </span>
                </div>
              </div>
        <div className="mt-2 text-xs text-slate-300">
          <span className="text-slate-400">End of horizon:</span>{" "}
          Savings <span className="text-white">{formatCurrencyWhole(goalsProjection.points[goalsProjection.points.length - 1]?.savings ?? 0)}</span>
          <span className="text-slate-500"> · </span>
          Emergency <span className="text-white">{formatCurrencyWhole(goalsProjection.points[goalsProjection.points.length - 1]?.emergency ?? 0)}</span>
            <span className="text-slate-500"> · </span>
            Investments <span className="text-white">{formatCurrencyWhole(goalsProjection.points[goalsProjection.points.length - 1]?.investments ?? 0)}</span>
        </div>
        <div className="mt-3 h-56 w-full">
          <Line data={projectionChart.data} options={projectionChart.options} />
        </div>
        <div className="mt-2 text-xs text-slate-400">Scale max: <Currency value={projectionChart.maxVal} /></div>
            </div>
          ) : (
			<div className="text-sm text-slate-300">Add an assumption to see a projection.</div>
          )}

        </div>
      )}
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
                          href={buildScopedPageHrefForPlan(pathname, plan.id, "expenses")}
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
