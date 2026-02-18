"use client";

import { useMemo } from "react";
import type { Goal } from "@/lib/goals/store";
import type { GoalsBudgetInsights, GoalsByYear } from "@/types";

import DashboardGoalsPanel from "@/components/Admin/Goals/DashboardGoalsPanel";
import GoalsGrid from "@/components/Admin/Goals/GoalsGrid";
import { useDashboardGoals } from "@/lib/hooks/useDashboardGoals";

export default function GoalsPageClient({
  budgetPlanId,
  minYear,
  maxYear,
  outOfHorizonGoals,
  goalsByYear,
  initialHomepageGoalIds,
  budgetInsights,
	startingBalances,
	contributionTotals,
}: {
  budgetPlanId: string;
  minYear: number;
  maxYear: number;
  outOfHorizonGoals: Goal[];
  goalsByYear: GoalsByYear[];
  initialHomepageGoalIds: string[];
  budgetInsights: GoalsBudgetInsights | null;
	startingBalances?: {
		savings?: number;
		emergency?: number;
    investment?: number;
	};
  contributionTotals?: {
    year: number;
    throughMonth: number;
    savings: number;
    emergency: number;
    investment: number;
    allowance: number;
  };
}) {
  const allGoals = useMemo(() => {
    const flattened: Goal[] = [];
    flattened.push(...outOfHorizonGoals);
    goalsByYear.forEach((g) => flattened.push(...g.goals));
    const byId = new Map<string, Goal>();
    flattened.forEach((goal) => {
      if (!byId.has(goal.id)) byId.set(goal.id, goal);
    });
    return Array.from(byId.values());
  }, [goalsByYear, outOfHorizonGoals]);

  const {
    isPending,
    homepageError,
    usingDefaults,
    selectedCount,
    defaultSelectedIds,
    selectedGoals,
    toggleHomepage,
    resetHomepage,
    getToggleState,
  } = useDashboardGoals({ budgetPlanId, allGoals, initialHomepageGoalIds });

  return (
    <>
      <DashboardGoalsPanel
        selectedGoals={selectedGoals}
        selectedCount={selectedCount}
        usingDefaults={usingDefaults}
        hasDefaults={defaultSelectedIds.length > 0}
        isPending={isPending}
        onReset={resetHomepage}
        onToggleGoal={toggleHomepage}
      />

      {homepageError ? (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {homepageError}
        </div>
      ) : null}

      {outOfHorizonGoals.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 backdrop-blur-xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-amber-100">
                  Some goals are outside your budget horizon
                </h2>
                <p className="text-xs sm:text-sm text-amber-200/80 mt-0.5">
                  Update their target year to be between {minYear} and {maxYear}.
                </p>
              </div>
              <div className="text-xs sm:text-sm text-amber-100 font-semibold">
                {outOfHorizonGoals.length} needing update
              </div>
            </div>
            <div className="mt-4">
              <GoalsGrid
                goals={outOfHorizonGoals}
                budgetPlanId={budgetPlanId}
                minYear={minYear}
                maxYear={maxYear}
                budgetInsights={budgetInsights}
					startingBalances={startingBalances}
					contributionTotals={contributionTotals}
                getToggleState={getToggleState}
                onToggleHomepage={toggleHomepage}
              />
            </div>
          </div>
        </div>
      )}

      {goalsByYear.map(({ year, goals }) => {
        if (goals.length === 0) return null;
        return (
          <div key={year} className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">{year} Goals</h2>
            <GoalsGrid
              goals={goals}
              budgetPlanId={budgetPlanId}
              minYear={minYear}
              maxYear={maxYear}
              budgetInsights={budgetInsights}
				startingBalances={startingBalances}
			contributionTotals={contributionTotals}
              getToggleState={getToggleState}
              onToggleHomepage={toggleHomepage}
            />
          </div>
        );
      })}
    </>
  );
}
