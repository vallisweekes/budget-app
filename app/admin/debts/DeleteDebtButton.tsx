"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/Shared";
import { deleteDebtAction } from "@/lib/debts/actions";
import { useSearchParams } from "next/navigation";

export default function DeleteDebtButton({
  debtId,
  debtName,
  budgetPlanId,
}: {
  debtId: string;
  debtName: string;
  budgetPlanId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const searchParams = useSearchParams();
  const planId = budgetPlanId ?? searchParams.get("plan") ?? "";

  return (
    <>
      <ConfirmModal
        open={confirmingDelete}
        title="Delete debt?"
        description={`This will permanently delete \"${debtName}\".`}
        tone="danger"
        confirmText="Delete"
        cancelText="Keep"
        isBusy={isPending}
        onClose={() => {
          if (!isPending) setConfirmingDelete(false);
        }}
        onConfirm={() => {
          startTransition(async () => {
				if (!planId) return;
            await deleteDebtAction(planId, debtId);
          });
          setConfirmingDelete(false);
        }}
      />

      <button
        type="button"
        onClick={() => setConfirmingDelete(true)}
        disabled={isPending}
        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        title="Delete debt"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </>
  );
}
