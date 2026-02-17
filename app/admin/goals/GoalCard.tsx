"use client";

import { useState, useTransition } from "react";
import { Edit2, Trash2, Check, X, Target, TrendingUp, Shield, PiggyBank } from "lucide-react";
import { updateGoalAction, deleteGoalAction } from "@/lib/goals/actions";
import { formatCurrency } from "@/lib/helpers/money";
import { ConfirmModal } from "@/components/Shared";

interface Goal {
  id: string;
  title: string;
  targetAmount?: number;
  currentAmount?: number;
  type: "yearly" | "long-term";
  category: "debt" | "savings" | "emergency" | "investment" | "other";
  targetYear?: number;
  description?: string;
}

interface GoalCardProps {
  goal: Goal;
	budgetPlanId: string;
}

const categoryIcons = {
  debt: TrendingUp,
  savings: PiggyBank,
  emergency: Shield,
  investment: Target,
  other: Target,
};

const categoryColors = {
  debt: "from-red-400 to-red-600",
  savings: "from-emerald-400 to-emerald-600",
  emergency: "from-blue-400 to-blue-600",
  investment: "from-purple-400 to-purple-600",
  other: "from-zinc-400 to-zinc-600",
};

function Currency({ value }: { value: number }) {
  return <span>{formatCurrency(value)}</span>;
}

const CARD_CLASS = "bg-[#9EDBFF] rounded-2xl shadow-xl border border-sky-200/70 p-6";
const INPUT_CLASS =
  "w-full px-3 py-2 bg-white/70 border border-black/10 text-slate-900 placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

export default function GoalCard({ goal, budgetPlanId }: GoalCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editTargetAmount, setEditTargetAmount] = useState(goal.targetAmount?.toString() || "");
  const [editCurrentAmount, setEditCurrentAmount] = useState(goal.currentAmount?.toString() || "");
  const [editDescription, setEditDescription] = useState(goal.description || "");

  const Icon = categoryIcons[goal.category];
  const gradient = categoryColors[goal.category];
  const progress = goal.targetAmount && goal.currentAmount ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

  const handleSave = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("budgetPlanId", budgetPlanId);
      formData.append("title", editTitle);
      if (editTargetAmount) formData.append("targetAmount", editTargetAmount);
      if (editCurrentAmount) formData.append("currentAmount", editCurrentAmount);
      if (editDescription) formData.append("description", editDescription);

      await updateGoalAction(goal.id, formData);
      setIsEditing(false);
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(goal.title);
    setEditTargetAmount(goal.targetAmount?.toString() || "");
    setEditCurrentAmount(goal.currentAmount?.toString() || "");
    setEditDescription(goal.description || "");
  };

  const confirmDelete = () => {
    startTransition(async () => {
      await deleteGoalAction(budgetPlanId, goal.id);
    });
  };

  if (isEditing) {
    return (
      <div className={CARD_CLASS}>
        <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl shadow-md flex-shrink-0`}>
            <Icon className="text-white" size={18} />
          </div>
          <div className="flex-1 space-y-2 sm:space-y-3">
            <label>
              <span className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-0.5 sm:mb-1">Goal Title</span>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Goal title"
                aria-label="Goal title"
              />
            </label>
            <label>
              <span className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-0.5 sm:mb-1">Description</span>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Description (optional)"
                aria-label="Goal description"
                rows={2}
              />
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <label>
                <span className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-0.5 sm:mb-1">Target Amount</span>
                <input
                  type="number"
                  step="0.01"
                  value={editTargetAmount}
                  onChange={(e) => setEditTargetAmount(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Target £"
                  aria-label="Target amount"
                />
              </label>
              <label>
                <span className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-0.5 sm:mb-1">Current Amount</span>
                <input
                  type="number"
                  step="0.01"
                  value={editCurrentAmount}
                  onChange={(e) => setEditCurrentAmount(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Current £"
                  aria-label="Current amount"
                />
              </label>
            </div>
          </div>
          <div className="flex gap-0.5 sm:gap-1">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="p-1.5 sm:p-2 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
              title="Save"
            >
              <Check size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            <button
              onClick={handleCancel}
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
          if (!isPending) setConfirmingDelete(false);
        }}
        onConfirm={() => {
          confirmDelete();
          setConfirmingDelete(false);
        }}
      />
      <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl shadow-md flex-shrink-0`}>
          <Icon className="text-white" size={18} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-base sm:text-lg text-slate-900">{goal.title}</h3>
          {goal.description && (
            <p className="text-xs sm:text-sm text-slate-700 mt-0.5 sm:mt-1">{goal.description}</p>
          )}
          {goal.targetYear && (
            <p className="text-[10px] sm:text-xs text-slate-700 mt-0.5 sm:mt-1">Target: {goal.targetYear}</p>
          )}
        </div>
        <div className="flex gap-0.5 sm:gap-1">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 sm:p-2 hover:bg-black/5 rounded-lg text-slate-800 transition-colors cursor-pointer"
            title="Edit"
          >
            <Edit2 size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
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
