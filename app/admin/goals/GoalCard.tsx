"use client";

import { useState, useTransition } from "react";
import { Edit2, Trash2, Check, X, Target, TrendingUp, Shield, PiggyBank } from "lucide-react";
import { updateGoalAction, deleteGoalAction } from "@/lib/goals/actions";
import { formatCurrency } from "@/lib/helpers/money";
import { ConfirmModal } from "@/components/Shared";
import { useSearchParams } from "next/navigation";

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

export default function GoalCard({ goal }: GoalCardProps) {
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const budgetPlanId = searchParams.get("plan") ?? "";
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editTargetAmount, setEditTargetAmount] = useState(goal.targetAmount?.toString() || "");
  const [editCurrentAmount, setEditCurrentAmount] = useState(goal.currentAmount?.toString() || "");
  const [editDescription, setEditDescription] = useState(goal.description || "");

  const Icon = categoryIcons[goal.category];
  const gradient = categoryColors[goal.category];
  const progress = goal.targetAmount && goal.currentAmount 
    ? (goal.currentAmount / goal.targetAmount) * 100 
    : 0;

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

  const handleDeleteClick = () => {
    setConfirmingDelete(true);
  };

  const confirmDelete = () => {
    startTransition(async () => {
      await deleteGoalAction(budgetPlanId, goal.id);
    });
  };

  if (isEditing) {
    return (
      <div className="bg-slate-800/40 rounded-2xl shadow-xl border border-white/10 backdrop-blur-xl p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-12 h-12 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl shadow-md flex-shrink-0`}>
            <Icon className="text-white" size={24} />
          </div>
          <div className="flex-1 space-y-3">
            <label>
              <span className="block text-xs font-medium text-slate-300 mb-1">Goal Title</span>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Goal title"
                aria-label="Goal title"
              />
            </label>
            <label>
              <span className="block text-xs font-medium text-slate-300 mb-1">Description</span>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Description (optional)"
                aria-label="Goal description"
                rows={2}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="block text-xs font-medium text-slate-300 mb-1">Target Amount</span>
                <input
                  type="number"
                  step="0.01"
                  value={editTargetAmount}
                  onChange={(e) => setEditTargetAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Target £"
                  aria-label="Target amount"
                />
              </label>
              <label>
                <span className="block text-xs font-medium text-slate-300 mb-1">Current Amount</span>
                <input
                  type="number"
                  step="0.01"
                  value={editCurrentAmount}
                  onChange={(e) => setEditCurrentAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Current £"
                  aria-label="Current amount"
                />
              </label>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
              title="Save"
            >
              <Check size={18} />
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Cancel"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 rounded-2xl shadow-xl border border-white/10 backdrop-blur-xl p-6">
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
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl shadow-md flex-shrink-0`}>
          <Icon className="text-white" size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-white">{goal.title}</h3>
          {goal.description && (
            <p className="text-sm text-slate-400 mt-1">{goal.description}</p>
          )}
          {goal.targetYear && (
            <p className="text-xs text-slate-400 mt-1">Target: {goal.targetYear}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 hover:bg-blue-500/10 rounded-lg text-blue-400 transition-colors cursor-pointer"
            title="Edit"
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={handleDeleteClick}
            disabled={isPending}
            className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {goal.targetAmount && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-300">Progress</span>
            <span className="font-semibold text-white">
              <Currency value={goal.currentAmount || 0} /> / <Currency value={goal.targetAmount} />
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div
              className={`bg-gradient-to-r ${gradient} h-3 rounded-full transition-all`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="text-right text-xs text-slate-400 mt-1">
            {progress.toFixed(1)}% complete
          </div>
        </div>
      )}
    </div>
  );
}
