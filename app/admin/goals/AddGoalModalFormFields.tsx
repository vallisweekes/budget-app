import type { Goal } from "@/lib/goals/store";

import { SelectDropdown } from "@/components/Shared";

type GoalType = Goal["type"];
type GoalCategory = Goal["category"];

export default function AddGoalModalFormFields({
  title,
  onTitleChange,
  type,
  onTypeChange,
  category,
  onCategoryChange,
  targetAmount,
  onTargetAmountChange,
  currentAmount,
  onCurrentAmountChange,
  targetYear,
  onTargetYearChange,
  description,
  onDescriptionChange,
  minYear,
  maxYear,
  error,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  type: GoalType;
  onTypeChange: (value: GoalType) => void;
  category: GoalCategory;
  onCategoryChange: (value: GoalCategory) => void;
  targetAmount: string;
  onTargetAmountChange: (value: string) => void;
  currentAmount: string;
  onCurrentAmountChange: (value: string) => void;
  targetYear: string;
  onTargetYearChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  minYear: number;
  maxYear: number;
  error: string | null;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Goal title</span>
        <input
          autoFocus
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xs sm:text-sm"
          placeholder="e.g., Pay off debt"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Goal type</span>
          <SelectDropdown
            value={type}
            onValueChange={(v) => onTypeChange(v as GoalType)}
            options={[
              { value: "yearly", label: "Yearly" },
              { value: "long-term", label: "Long-term" },
            ]}
            buttonClassName="focus:ring-purple-500 text-xs sm:text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Category</span>
          <SelectDropdown
            value={category}
            onValueChange={(v) => onCategoryChange(v as GoalCategory)}
            options={[
              { value: "debt", label: "Debt" },
              { value: "savings", label: "Savings" },
              { value: "emergency", label: "Emergency" },
              { value: "investment", label: "Investment" },
              { value: "other", label: "Other" },
            ]}
            buttonClassName="focus:ring-purple-500 text-xs sm:text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Target amount (£)</span>
          <input
            value={targetAmount}
            onChange={(e) => onTargetAmountChange(e.target.value)}
            type="number"
            step="0.01"
            className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xs sm:text-sm"
            placeholder="Optional"
          />
        </label>
        <label className="block">
          <span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Current amount (£)</span>
          <input
            value={currentAmount}
            onChange={(e) => onCurrentAmountChange(e.target.value)}
            type="number"
            step="0.01"
            className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xs sm:text-sm"
            placeholder="Optional"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Target year</span>
        <input
          value={targetYear}
          onChange={(e) => onTargetYearChange(e.target.value)}
          type="number"
          min={minYear}
          max={maxYear}
          className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xs sm:text-sm"
          placeholder={`${minYear}–${maxYear}`}
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Choose a year within your budget horizon ({minYear}–{maxYear}).
        </p>
      </label>

      <label className="block">
        <span className="text-xs sm:text-sm font-medium text-slate-300 mb-1 block">Description</span>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all resize-none text-xs sm:text-sm"
          placeholder="Optional notes"
        />
      </label>

      {error ? (
        <p className="text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
