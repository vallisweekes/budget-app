import type { LucideIcon } from "lucide-react";
import type { Goal } from "@/lib/goals/store";
import type { GoalsBudgetInsights } from "@/types";

import { DeleteConfirmModal } from "@/components/Shared";

import GoalCardHeader from "@/components/Admin/Goals/GoalCardHeader";
import GoalCardProgress from "@/components/Admin/Goals/GoalCardProgress";
import { CARD_CLASS } from "@/components/Admin/Goals/goalCardStyles";

export default function GoalCardReadView({
  goal,
  icon: Icon,
  gradient,
  isPending,
  budgetInsights,
	monthlyTip,
	startingBalances,
	contributionTotals,
  homepageSelected = false,
  homepageToggleDisabled = false,
  homepageToggleDisabledReason,
  onToggleHomepage,
  confirmingDelete,
  onStartEdit,
  onOpenDelete,
  onCloseDelete,
  onConfirmDelete,
}: {
  goal: Goal;
  icon: LucideIcon;
  gradient: string;
  isPending: boolean;
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
  homepageSelected?: boolean;
  homepageToggleDisabled?: boolean;
  homepageToggleDisabledReason?: string;
  onToggleHomepage?: () => void;
  confirmingDelete: boolean;
  onStartEdit: () => void;
  onOpenDelete: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <div className={CARD_CLASS}>
      <DeleteConfirmModal
        open={confirmingDelete}
        title="Delete goal?"
        description={`This will permanently delete "${goal.title}".`}
        confirmText="Delete"
        cancelText="Keep"
        isBusy={isPending}
        onClose={() => {
          if (!isPending) onCloseDelete();
        }}
        onConfirm={() => {
          onConfirmDelete();
          onCloseDelete();
        }}
      />

      <GoalCardHeader
        goal={goal}
        icon={Icon}
        gradient={gradient}
        homepageSelected={homepageSelected}
        homepageToggleDisabled={homepageToggleDisabled}
        homepageToggleDisabledReason={homepageToggleDisabledReason}
        onToggleHomepage={onToggleHomepage}
        isPending={isPending}
        onStartEdit={onStartEdit}
        onOpenDelete={onOpenDelete}
      />

      <GoalCardProgress
        goal={goal}
        gradient={gradient}
        budgetInsights={budgetInsights}
		monthlyTip={monthlyTip}
        startingBalances={startingBalances}
		contributionTotals={contributionTotals}
      />
    </div>
  );
}
