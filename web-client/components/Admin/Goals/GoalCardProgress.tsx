import type { Goal } from "@/lib/goals/store";
import type { GoalsBudgetInsights } from "@/types";

import { formatCurrency } from "@/lib/helpers/money";
import { getGoalMonthlyTip } from "@/lib/helpers/goals";

function Currency({ value }: { value: number }) {
  return <span>{formatCurrency(value)}</span>;
}

export default function GoalCardProgress({
  goal,
  gradient,
  budgetInsights,
	monthlyTip,
  startingBalances,
  contributionTotals,
}: {
  goal: Goal;
  gradient: string;
  budgetInsights?: GoalsBudgetInsights | null;
	monthlyTip?: string | null;
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
  if (!goal.targetAmount) return null;

  const isComputedBalanceGoal = goal.category === "savings" || goal.category === "emergency" || goal.category === "investment";

  const trackedAmount = isComputedBalanceGoal
    ? goal.category === "savings"
      ? (contributionTotals?.savings ?? 0)
      : goal.category === "emergency"
        ? (contributionTotals?.emergency ?? 0)
        : (contributionTotals?.investment ?? 0)
    : (goal.currentAmount ?? 0);
	const startingAmount =
		goal.category === "savings"
			? (startingBalances?.savings ?? 0)
			: goal.category === "emergency"
				? (startingBalances?.emergency ?? 0)
        : goal.category === "investment"
          ? (startingBalances?.investment ?? 0)
				: 0;
	const effectiveCurrent = trackedAmount + startingAmount;

  const progress = (effectiveCurrent / goal.targetAmount) * 100;
	const fallbackTip = getGoalMonthlyTip({ goal: { ...goal, currentAmount: effectiveCurrent }, budgetInsights });
	const resolvedTip = (monthlyTip ?? "").trim() || fallbackTip;

  return (
    <div>
      <div className="flex justify-between text-xs sm:text-sm mb-1 sm:mb-2">
        <span className="text-slate-700 font-medium">Progress</span>
        <span className="font-semibold text-slate-900">
						<Currency value={effectiveCurrent} /> / <Currency value={goal.targetAmount} />
        </span>
      </div>
			<div className="w-full bg-black/10 rounded-full h-2 sm:h-4">
        <div
					className={`bg-gradient-to-r ${gradient} h-2 sm:h-4 rounded-full transition-all`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <div className="text-right text-[10px] sm:text-xs text-slate-700 mt-0.5 sm:mt-1">
        {progress.toFixed(1)}% complete
      </div>

    {(startingAmount > 0 || trackedAmount > 0) && isComputedBalanceGoal ? (
      <div className="text-right text-[10px] sm:text-xs text-slate-600 mt-0.5">
  			Includes <span className="font-semibold">{formatCurrency(startingAmount)}</span> starting balance +{" "}
  			<span className="font-semibold">{formatCurrency(trackedAmount)}</span> contributed
      </div>
    ) : null}

      {resolvedTip ? (
        <div className="mt-3 rounded-xl bg-black/5 px-3 py-2 text-[11px] sm:text-xs text-slate-800">
          <span className="font-semibold">Tip:</span> {resolvedTip}
        </div>
      ) : null}
    </div>
  );
}
