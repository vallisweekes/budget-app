"use client";

import { useState, useTransition } from "react";
import type { Goal } from "@/lib/goals/store";
import type { GoalsBudgetInsights } from "@/types";

import { Target, TrendingUp, Shield, PiggyBank } from "lucide-react";
import { updateGoalAction, deleteGoalAction } from "@/lib/goals/actions";
import GoalCardEditView from "@/components/Admin/Goals/GoalCardEditView";
import GoalCardReadView from "@/components/Admin/Goals/GoalCardReadView";

interface GoalCardProps {
  goal: Goal;
  budgetPlanId: string;
  minYear?: number;
  maxYear?: number;
  budgetInsights?: GoalsBudgetInsights | null;
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
  emergency: "from-cyan-400 to-cyan-600",
  investment: "from-purple-400 to-purple-600",
  other: "from-zinc-400 to-zinc-600",
};

export default function GoalCard({
  goal,
  budgetPlanId,
  minYear,
  maxYear,
  budgetInsights,
	startingBalances,
	contributionTotals,
  homepageSelected,
  homepageToggleDisabled,
  homepageToggleDisabledReason,
  onToggleHomepage,
}: GoalCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editTargetAmount, setEditTargetAmount] = useState(goal.targetAmount?.toString() || "");
  const [editCurrentAmount, setEditCurrentAmount] = useState(goal.currentAmount?.toString() || "");
  const [editTargetYear, setEditTargetYear] = useState(goal.targetYear?.toString() || "");
  const [editDescription, setEditDescription] = useState(goal.description || "");

  const isComputedBalanceGoal = goal.category === "savings" || goal.category === "emergency" || goal.category === "investment";
	const computedCurrentAmount =
		goal.category === "savings"
			? (startingBalances?.savings ?? 0) + (contributionTotals?.savings ?? 0)
			: goal.category === "emergency"
				? (startingBalances?.emergency ?? 0) + (contributionTotals?.emergency ?? 0)
        : goal.category === "investment"
          ? (startingBalances?.investment ?? 0) + (contributionTotals?.investment ?? 0)
				: (goal.currentAmount ?? 0);

  const Icon = categoryIcons[goal.category];
  const gradient = categoryColors[goal.category];

  const handleSave = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("budgetPlanId", budgetPlanId);
      formData.append("title", editTitle);
      if (editTargetAmount) formData.append("targetAmount", editTargetAmount);
        if (!isComputedBalanceGoal && editCurrentAmount) formData.append("currentAmount", editCurrentAmount);
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

	const startEdit = () => {
		setEditTitle(goal.title);
		setEditTargetAmount(goal.targetAmount?.toString() || "");
    setEditCurrentAmount(isComputedBalanceGoal ? String(computedCurrentAmount) : (goal.currentAmount?.toString() || ""));
		setEditTargetYear(goal.targetYear?.toString() || "");
		setEditDescription(goal.description || "");
		setIsEditing(true);
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
        currentAmountDisabled={isComputedBalanceGoal}
			currentAmountHelpText={
          isComputedBalanceGoal
					? `Calculated from starting balance + contributions through month ${contributionTotals?.throughMonth ?? "?"} (${contributionTotals?.year ?? "?"}).`
					: undefined
			}
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
      budgetInsights={budgetInsights}
		startingBalances={startingBalances}
		contributionTotals={contributionTotals}
      homepageSelected={Boolean(homepageSelected)}
      homepageToggleDisabled={Boolean(homepageToggleDisabled)}
      homepageToggleDisabledReason={homepageToggleDisabledReason}
      onToggleHomepage={onToggleHomepage}
      confirmingDelete={confirmingDelete}
			onStartEdit={startEdit}
      onOpenDelete={() => setConfirmingDelete(true)}
      onCloseDelete={() => setConfirmingDelete(false)}
      onConfirmDelete={confirmDelete}
    />
  );
}
