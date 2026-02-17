import type { LucideIcon } from "lucide-react";
import type { Goal } from "@/lib/goals/store";

import { Edit2, Trash2 } from "lucide-react";

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
  confirmingDelete: boolean;
  onStartEdit: () => void;
  onOpenDelete: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const progress = goal.targetAmount
    ? ((goal.currentAmount ?? 0) / goal.targetAmount) * 100
    : 0;

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
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl shadow-md flex-shrink-0`}
        >
          <Icon className="text-white" size={18} />
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-base sm:text-lg text-slate-900">{goal.title}</h3>
            <span
              className={
                goal.targetYear
                  ? "inline-flex items-center rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-900 border border-black/10"
                  : "inline-flex items-center rounded-full bg-amber-200/70 px-2.5 py-1 text-[11px] font-semibold text-amber-950 border border-amber-900/20"
              }
              title={goal.targetYear ? "Target year" : "No target year set"}
            >
              {goal.targetYear ? `Target ${goal.targetYear}` : "Set target year"}
            </span>
          </div>
          {goal.description && (
            <p className="text-xs sm:text-sm text-slate-700 mt-0.5 sm:mt-1">{goal.description}</p>
          )}
        </div>

        <div className="flex gap-0.5 sm:gap-1">
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
