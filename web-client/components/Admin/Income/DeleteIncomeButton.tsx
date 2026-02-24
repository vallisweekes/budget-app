"use client";

import { Trash2 } from "lucide-react";
import { DeleteConfirmModal } from "@/components/Shared";
import type { MonthKey } from "@/types";
import { useDeleteIncomeButton } from "@/lib/hooks/income/useDeleteIncomeButton";

interface DeleteIncomeButtonProps {
	id: string;
	budgetPlanId: string;
	year: number;
	month: MonthKey;
}

export default function DeleteIncomeButton({
	id,
	budgetPlanId,
	year,
	month,
}: DeleteIncomeButtonProps) {
	const { isPending, isOpen, open, close, confirm } = useDeleteIncomeButton({ id, budgetPlanId, year, month });

	return (
		<>
			<button
				onClick={open}
				disabled={isPending}
				className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
				aria-label="Delete income"
			>
				<Trash2 className="w-3 h-3" />
			</button>
			<DeleteConfirmModal
				open={isOpen}
				title="Delete Income"
				description="Are you sure you want to delete this income source? This action cannot be undone."
				isBusy={isPending}
				onConfirm={confirm}
				onClose={close}
			/>
		</>
	);
}
