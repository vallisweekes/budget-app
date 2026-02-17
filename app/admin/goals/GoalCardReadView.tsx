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

      <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className="flex flex-col items-start gap-1 flex-shrink-0">
      <span
        className={
          goal.targetYear
            ? "inline-flex items-center rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-900 border border-black/10"
            : "inline-flex items-center rounded-full bg-amber-200/70 px-2.5 py-1 text-[11px] font-semibold text-amber-950 border border-amber-900/20"
        }
        title={goal.targetYear ? "Target year" : "No target year set"}
      >
        {targetYearLabel}
      </span>
      <div
        className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl shadow-md`}
      >
        <Icon className="text-white" size={18} />
      </div>
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm sm:text-base text-slate-900">{goal.title}</h3>
          </div>
          {homepageSelected ? (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-900/10 px-2 py-0.5 text-[10px] font-semibold text-slate-800">
              <Home size={12} />
              <span>On dashboard</span>
            </div>
          ) : null}
          {goal.description && (
            <p className="text-[11px] sm:text-xs text-slate-700 mt-0.5 sm:mt-1">{goal.description}</p>
          )}
        </div>

        <div className="flex gap-0.5 sm:gap-1">
      {onToggleHomepage ? (
          <div
            className={
              "inline-flex items-center gap-2 rounded-lg bg-black/5 px-2 py-1 sm:px-2 sm:py-1 " +
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
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-800">
              <Home size={12} className="text-slate-700" />
              Dashboard
            </span>
            <button
              type="button"
              onClick={onToggleHomepage}
              disabled={homepageToggleDisabled}
              role="switch"
              aria-checked={homepageSelected}
              className={
                "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors " +
                (homepageSelected ? "bg-slate-900" : "bg-slate-900/20") +
                " disabled:cursor-not-allowed"
              }
            >
              <span
                className={
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
                  (homepageSelected ? "translate-x-4" : "translate-x-0.5")
                }
              />
            </button>
          </div>
      ) : null}
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
