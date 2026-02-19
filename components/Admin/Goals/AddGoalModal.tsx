"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Goal } from "@/lib/goals/store";
import ConfirmModal from "@/components/Shared/ConfirmModal";
import { createGoal } from "@/lib/goals/actions";
import AddGoalModalFormFields from "@/components/Admin/Goals/AddGoalModalFormFields";

type GoalType = Goal["type"];
type GoalCategory = Goal["category"];

function validateTargetYear({
  targetYear,
  minYear,
  maxYear,
}: {
  targetYear: string;
  minYear: number;
  maxYear: number;
}): { ok: true; yearTrimmed: string } | { ok: false; message: string } {
  const yearTrimmed = targetYear.trim();
  if (!yearTrimmed) return { ok: true, yearTrimmed: "" };
  const parsed = Number.parseInt(yearTrimmed, 10);
  if (Number.isNaN(parsed)) return { ok: false, message: "Please enter a valid target year." };
  if (parsed < minYear || parsed > maxYear) {
    return { ok: false, message: `Target year must be between ${minYear} and ${maxYear}.` };
  }
  return { ok: true, yearTrimmed };
}

export default function AddGoalModal({
  budgetPlanId,
  minYear,
  maxYear,
  defaultYear,
  defaultBalances,
}: {
  budgetPlanId: string;
  minYear: number;
  maxYear: number;
  defaultYear: number;
  defaultBalances?: {
		savings?: number;
		emergency?: number;
    investment?: number;
	};
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<GoalType>("yearly");
  const [category, setCategory] = useState<GoalCategory>("debt");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [targetYear, setTargetYear] = useState("");
  const [description, setDescription] = useState("");

  const canSubmit = useMemo(() => Boolean(budgetPlanId && title.trim()), [budgetPlanId, title]);

  function resetForm() {
    setTitle("");
    setType("yearly");
    setCategory("debt");
    setTargetAmount("");
    setCurrentAmount("");
    setTargetYear(String(defaultYear));
    setDescription("");
    setError(null);
  }

  useEffect(() => {
    // Starting balances are added to goal progress automatically.
    // Keep the tracked current amount independent to avoid double-counting.
    if (!open) return;
    // No-op (intentionally).
  }, [open]);

  return (
    <>
      <div className="flex items-center justify-start gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--cta)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-[var(--cta-hover)] hover:shadow-xl hover:scale-[1.02] active:bg-[var(--cta-active)] transition"
        >
          <Plus className="h-4 w-4" />
          Add goal
        </button>
      </div>

      <ConfirmModal
        open={open}
        title="Add a goal"
        description="Set a target and track your progress over time."
        confirmText="Add goal"
        cancelText="Cancel"
        tone="default"
        isBusy={isPending}
        confirmDisabled={!canSubmit}
        onClose={() => {
          if (isPending) return;
          setOpen(false);
        }}
        onConfirm={() => {
          startTransition(async () => {
            setError(null);
            try {
              const yearResult = validateTargetYear({ targetYear, minYear, maxYear });
              if (!yearResult.ok) {
                setError(yearResult.message);
                return;
              }
              const yearTrimmed = yearResult.yearTrimmed;

              const formData = new FormData();
              formData.append("budgetPlanId", budgetPlanId);
              formData.append("title", title.trim());
              formData.append("type", type);
              formData.append("category", category);
              if (targetAmount.trim()) formData.append("targetAmount", targetAmount.trim());
              if (currentAmount.trim()) formData.append("currentAmount", currentAmount.trim());
              if (yearTrimmed) formData.append("targetYear", yearTrimmed);
              if (description.trim()) formData.append("description", description.trim());

              await createGoal(formData);
              setOpen(false);
              router.refresh();
            } catch (e) {
              const message =
                e instanceof Error && e.message
                  ? e.message
                  : "Unable to add goal. Please try again.";
              setError(message);
            }
          });
        }}
      >
        <AddGoalModalFormFields
          title={title}
          onTitleChange={setTitle}
          type={type}
          onTypeChange={setType}
          category={category}
          onCategoryChange={setCategory}
          targetAmount={targetAmount}
          onTargetAmountChange={setTargetAmount}
          currentAmount={currentAmount}
          onCurrentAmountChange={setCurrentAmount}
          targetYear={targetYear}
          onTargetYearChange={setTargetYear}
          description={description}
          onDescriptionChange={setDescription}
          minYear={minYear}
          maxYear={maxYear}
          error={error}
        />
      </ConfirmModal>
    </>
  );
}
