import type { LucideIcon } from "lucide-react";
import type { Goal } from "@/lib/goals/store";

import { Edit2, Home, Trash2 } from "lucide-react";

import { formatCurrency } from "@/lib/helpers/money";
import { ConfirmModal } from "@/components/Shared";
import { CARD_CLASS } from "@/app/admin/goals/goalCardStyles";

function Currency({ value }: { value: number }) {
  return <span>{formatCurrency(value)}</span>;
}

export default function GoalCardReadView({
  goal,
  icon: Icon,
  gradient,
  isPending,
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
  const progress = goal.targetAmount
    ? ((goal.currentAmount ?? 0) / goal.targetAmount) * 100
    : 0;

	const targetYearLabel = goal.targetYear ? `Target ${goal.targetYear}` : "Set target year";
  // Eligibility rules are handled by the Goals page + API; the card only reflects disabled/selected state.

  return (
    <div className={CARD_CLASS}>
      <ConfirmModal
        open={confirmingDelete}
        title="Delete goal?"
        description={`This will permanently delete \"${goal.title}\".`}
        tone="danger"
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

      <div className="mb-3 sm:mb-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className={
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border " +
              "bg-[color:var(--background)] " +
              (goal.targetYear
                ? "text-slate-100 border-white/10"
                : "text-amber-200 border-amber-400/20")
            }
            title={goal.targetYear ? "Target year" : "No target year set"}
          >
            {targetYearLabel}
          </span>

          {onToggleHomepage ? (
            <button
              type="button"
              onClick={onToggleHomepage}
              disabled={homepageToggleDisabled}
              role="switch"
              aria-checked={homepageSelected}
              aria-label="Dashboard"
              className={
                "inline-flex items-center gap-2 rounded-lg bg-black/5 px-2 py-1 transition-colors hover:bg-black/10 disabled:cursor-not-allowed " +
                (homepageToggleDisabled ? "opacity-60" : "")
              }
              title={
                homepageToggleDisabled && homepageToggleDisabledReason
                  ? homepageToggleDisabledReason
                  : homepageSelected
                    ? "Shown on dashboard"
                    : "Hidden from dashboard"
              }
            >
              <Home size={12} className="text-slate-700" />
              <span className="sr-only">Dashboard</span>
              <span
                aria-hidden="true"
                className={
                  "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors " +
                  (homepageSelected ? "bg-slate-900" : "bg-slate-900/20")
                }
              >
                <span
                  className={
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
                    (homepageSelected ? "translate-x-4" : "translate-x-0.5")
                  }
                />
              </span>
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl shadow-md flex-shrink-0`}
            >
              <Icon className="text-white" size={18} />
            </div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug break-words min-w-0">
              {goal.title}
            </h3>
          </div>

          <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
            <button
              onClick={onStartEdit}
              className="p-1.5 sm:p-2 hover:bg-black/5 rounded-lg text-slate-800 transition-colors cursor-pointer"
              title="Edit"
            >
              <Edit2 size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            <button
              onClick={onOpenDelete}
              disabled={isPending}
              className="p-1.5 sm:p-2 hover:bg-red-500/10 rounded-lg text-red-600 transition-colors cursor-pointer"
              title="Delete"
            >
              <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </div>
        </div>

        {goal.description ? (
          <p className="mt-2 text-[11px] sm:text-xs text-slate-700">{goal.description}</p>
        ) : null}
      </div>

      {goal.targetAmount && (
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
        </div>
      )}
    </div>
  );
}
