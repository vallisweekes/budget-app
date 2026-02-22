import type { Goal } from "@/lib/goals/store";
import type { GoalsBudgetInsights } from "@/types";

import GoalCard from "@/components/Admin/Goals/GoalCard";

export default function GoalsGrid({
  goals,
  budgetPlanId,
  minYear,
  maxYear,
  budgetInsights,
	startingBalances,
	contributionTotals,
  getToggleState,
  onToggleHomepage,
}: {
  goals: Goal[];
  budgetPlanId: string;
  minYear: number;
  maxYear: number;
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
  getToggleState: (goal: Goal) => {
    selected: boolean;
    disabled: boolean;
    disabledReason?: string;
  };
  onToggleHomepage: (goal: Goal) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      {goals.map((goal) => {
        const { selected, disabled, disabledReason } = getToggleState(goal);
        return (
          <GoalCard
            key={goal.id}
            goal={goal}
            budgetPlanId={budgetPlanId}
            minYear={minYear}
            maxYear={maxYear}
            budgetInsights={budgetInsights}
				startingBalances={startingBalances}
			contributionTotals={contributionTotals}
            homepageSelected={selected}
            homepageToggleDisabled={disabled}
            homepageToggleDisabledReason={disabledReason}
            onToggleHomepage={() => onToggleHomepage(goal)}
          />
        );
      })}
    </div>
  );
}
