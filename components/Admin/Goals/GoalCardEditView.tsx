import type { LucideIcon } from "lucide-react";

import { Check, X } from "lucide-react";

import { CARD_CLASS, INPUT_CLASS } from "@/components/Admin/Goals/goalCardStyles";

export default function GoalCardEditView({
  icon: Icon,
  gradient,
  minYear,
  maxYear,
  isPending,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  targetAmount,
  onTargetAmountChange,
  currentAmount,
  onCurrentAmountChange,
  targetYear,
  onTargetYearChange,
  onSave,
  onCancel,
}: {
  icon: LucideIcon;
  gradient: string;
  minYear?: number;
  maxYear?: number;
  isPending: boolean;
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  targetAmount: string;
  onTargetAmountChange: (value: string) => void;
  currentAmount: string;
  onCurrentAmountChange: (value: string) => void;
  targetYear: string;
  onTargetYearChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={CARD_CLASS}>
      <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl shadow-md flex-shrink-0`}
        >
          <Icon className="text-white" size={18} />
        </div>
        <div className="flex-1 space-y-2 sm:space-y-3">
          <label>
            <span className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-0.5 sm:mb-1">
              Goal Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Goal title"
              aria-label="Goal title"
            />
          </label>
          <label>
            <span className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-0.5 sm:mb-1">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Description (optional)"
              aria-label="Goal description"
              rows={2}
            />
          </label>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <label>
              <span className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-0.5 sm:mb-1">
                Target Amount
              </span>
              <input
                type="number"
                step="0.01"
                value={targetAmount}
                onChange={(e) => onTargetAmountChange(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Target £"
                aria-label="Target amount"
              />
            </label>
            <label>
              <span className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-0.5 sm:mb-1">
                Current Amount
              </span>
              <input
                type="number"
                step="0.01"
                value={currentAmount}
                onChange={(e) => onCurrentAmountChange(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Current £"
                aria-label="Current amount"
              />
            </label>
          </div>
          <label>
            <span className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-0.5 sm:mb-1">
              Target Year
            </span>
            <input
              type="number"
              value={targetYear}
              onChange={(e) => onTargetYearChange(e.target.value)}
              min={minYear}
              max={maxYear}
              className={INPUT_CLASS}
              placeholder={minYear && maxYear ? `${minYear}–${maxYear}` : "e.g., 2035"}
              aria-label="Target year"
            />
          </label>
        </div>
        <div className="flex gap-0.5 sm:gap-1">
          <button
            onClick={onSave}
            disabled={isPending}
            className="p-1.5 sm:p-2 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
            title="Save"
          >
            <Check size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="p-1.5 sm:p-2 text-slate-700 hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
            title="Cancel"
          >
            <X size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
