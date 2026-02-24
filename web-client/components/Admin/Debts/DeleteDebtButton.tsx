"use client";

import { Trash2 } from "lucide-react";
import { DeleteConfirmModal } from "@/components/Shared";
import { useDeleteDebtButton } from "@/lib/hooks/debts/useDeleteDebtButton";

export default function DeleteDebtButton({
  debtId,
  debtName,
  budgetPlanId,
}: {
  debtId: string;
  debtName: string;
  budgetPlanId?: string;
}) {
  const { isPending, confirmingDelete, open, close, confirm } = useDeleteDebtButton({ debtId, budgetPlanId });

  return (
    <>
      <DeleteConfirmModal
        open={confirmingDelete}
        title="Delete debt?"
        description={`This will permanently delete \"${debtName}\".`}
        confirmText="Delete"
        cancelText="Keep"
        isBusy={isPending}
        onClose={close}
        onConfirm={confirm}
      />

      <button
        type="button"
        onClick={open}
        disabled={isPending}
        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        title="Delete debt"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </>
  );
}
