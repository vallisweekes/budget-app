"use client";

import { useState, useTransition } from "react";
import { deleteCategory } from "./actions";
import ConfirmModal from "@/components/ConfirmModal";

export default function DeleteCategoryButton({
	categoryId,
	categoryName,
	hasExpenses,
	expenseCount,
}: {
	categoryId: string;
	categoryName: string;
	hasExpenses: boolean;
	expenseCount: number;
}) {
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const disabled = isPending || hasExpenses;

	return (
		<div className="flex flex-col items-end gap-2">
			<ConfirmModal
				open={confirmingDelete}
				title="Delete category?"
				description={`This will permanently delete \"${categoryName}\".`}
				tone="danger"
				confirmText="Delete"
				cancelText="Keep"
				isBusy={isPending}
				onClose={() => {
					if (!isPending) setConfirmingDelete(false);
				}}
				onConfirm={() => {
					setError(null);
					startTransition(async () => {
						const result = await deleteCategory(categoryId);
						if (!result.success) setError(result.error || "Failed to delete category.");
					});
					setConfirmingDelete(false);
				}}
			/>
			<button
				type="button"
				disabled={disabled}
				onClick={() => {
					if (hasExpenses) return;
					setConfirmingDelete(true);
				}}
				className={
					"p-2 rounded-xl border transition-all cursor-pointer " +
					(disabled
						? "border-white/10 bg-slate-900/40 text-slate-500 cursor-not-allowed"
						: "border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/40")
				}
				title={
					hasExpenses
						? `Cannot delete: used by ${expenseCount} expense${expenseCount !== 1 ? "s" : ""}`
						: "Delete category"
				}
			>
				<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m3-3h4a1 1 0 011 1v1H9V5a1 1 0 011-1z"
					/>
				</svg>
			</button>

			{hasExpenses && (
				<p className="text-xs text-slate-400 max-w-[180px] text-right">
					Used by {expenseCount} expense{expenseCount !== 1 ? "s" : ""}
				</p>
			)}

			{error && <p className="text-xs text-red-300 max-w-[220px] text-right">{error}</p>}
		</div>
	);
}
