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
}: {
  goal: Goal;
  gradient: string;
  budgetInsights?: GoalsBudgetInsights | null;
}) {
  if (!goal.targetAmount) return null;

  const progress = ((goal.currentAmount ?? 0) / goal.targetAmount) * 100;
  const monthlyTip = getGoalMonthlyTip({ goal, budgetInsights });

  return (
    <div>
      <div className="flex justify-between text-xs sm:text-sm mb-1 sm:mb-2">
        <span className="text-slate-700 font-medium">Progress</span>
        <span className="font-semibold text-slate-900">
          <Currency value={goal.currentAmount || 0} /> / <Currency value={goal.targetAmount} />
        </span>
      </div>
      <div className="w-full bg-slate-900/10 rounded-full h-2 sm:h-3">
        <div
          className={`bg-gradient-to-r ${gradient} h-2 sm:h-3 rounded-full transition-all`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <div className="text-right text-[10px] sm:text-xs text-slate-700 mt-0.5 sm:mt-1">
        {progress.toFixed(1)}% complete
      </div>

      {monthlyTip ? (
        <div className="mt-3 rounded-xl bg-black/5 px-3 py-2 text-[11px] sm:text-xs text-slate-800">
          <span className="font-semibold">Tip:</span> {monthlyTip}
        </div>
      ) : null}
    </div>
  );
}
