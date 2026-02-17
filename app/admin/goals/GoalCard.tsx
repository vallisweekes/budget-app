"use client";

import { useState, useTransition } from "react";
import type { Goal } from "@/lib/goals/store";

import { Target, TrendingUp, Shield, PiggyBank } from "lucide-react";
import { updateGoalAction, deleteGoalAction } from "@/lib/goals/actions";
import GoalCardEditView from "@/app/admin/goals/GoalCardEditView";
import GoalCardReadView from "@/app/admin/goals/GoalCardReadView";

interface GoalCardProps {
  goal: Goal;
	budgetPlanId: string;
  minYear?: number;
  maxYear?: number;
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

export default function GoalCard({ goal, budgetPlanId, minYear, maxYear }: GoalCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editTargetAmount, setEditTargetAmount] = useState(goal.targetAmount?.toString() || "");
  const [editCurrentAmount, setEditCurrentAmount] = useState(goal.currentAmount?.toString() || "");
  const [editTargetYear, setEditTargetYear] = useState(goal.targetYear?.toString() || "");
  const [editDescription, setEditDescription] = useState(goal.description || "");

  const Icon = categoryIcons[goal.category];
  const gradient = categoryColors[goal.category];

  const handleSave = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("budgetPlanId", budgetPlanId);
      formData.append("title", editTitle);
      if (editTargetAmount) formData.append("targetAmount", editTargetAmount);
      if (editCurrentAmount) formData.append("currentAmount", editCurrentAmount);
      formData.append("targetYear", editTargetYear);
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
    setEditTargetYear(goal.targetYear?.toString() || "");
    setEditDescription(goal.description || "");
  };

  const confirmDelete = () => {
    startTransition(async () => {
      await deleteGoalAction(budgetPlanId, goal.id);
    });
  };

  if (isEditing) {
    return (
      <GoalCardEditView
        icon={Icon}
        gradient={gradient}
        minYear={minYear}
        maxYear={maxYear}
        isPending={isPending}
        title={editTitle}
        onTitleChange={setEditTitle}
        description={editDescription}
        onDescriptionChange={setEditDescription}
        targetAmount={editTargetAmount}
        onTargetAmountChange={setEditTargetAmount}
        currentAmount={editCurrentAmount}
        onCurrentAmountChange={setEditCurrentAmount}
        targetYear={editTargetYear}
        onTargetYearChange={setEditTargetYear}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <GoalCardReadView
      goal={goal}
      icon={Icon}
      gradient={gradient}
      isPending={isPending}
      confirmingDelete={confirmingDelete}
      onStartEdit={() => setIsEditing(true)}
      onOpenDelete={() => setConfirmingDelete(true)}
      onCloseDelete={() => setConfirmingDelete(false)}
      onConfirmDelete={confirmDelete}
    />
  );
}
