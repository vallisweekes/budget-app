"use client";

import { useEffect, useState } from "react";
import { ConfirmModal } from "@/components/Shared";
import type { DeleteExpenseModalProps, DeleteExpenseScopeOptions } from "@/types/expenses-manager";

const DEFAULT_SCOPE: DeleteExpenseScopeOptions = {
	applyRemainingMonths: false,
	applyFutureYears: false,
};

export default function DeleteExpenseModal({
	open,
	expenseName,
	errorMessage,
	isBusy,
	initialScope,
	onClose,
	onConfirm,
}: DeleteExpenseModalProps) {
	const [scope, setScope] = useState<DeleteExpenseScopeOptions>(initialScope ?? DEFAULT_SCOPE);

	useEffect(() => {
		if (!open) return;
		setScope(initialScope ?? DEFAULT_SCOPE);
	}, [open, initialScope]);

	return (
		<ConfirmModal
			open={open}
			title="Delete expense?"
			description={
				expenseName
					? `${errorMessage ? `${errorMessage} ` : ""}This will permanently delete \"${expenseName}\".`
					: undefined
			}
			tone="danger"
			confirmText="Delete"
			cancelText="Keep"
			isBusy={isBusy}
			onClose={onClose}
			onConfirm={() => onConfirm(scope)}
		>
			<div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
				<div className="flex items-start gap-3">
					<input
						id="deleteApplyRemainingMonths"
						name="deleteApplyRemainingMonths"
						type="checkbox"
						checked={scope.applyRemainingMonths}
						onChange={(e) => {
							const next = e.target.checked;
							setScope((s) => ({
								...s,
								applyRemainingMonths: next,
								applyFutureYears: next ? s.applyFutureYears : false,
							}));
						}}
						className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900/40 text-red-500 focus:ring-red-500/50"
					/>
					<div className="min-w-0 flex-1">
						<label htmlFor="deleteApplyRemainingMonths" className="block text-sm font-semibold text-white">
							Delete in remaining months
						</label>
						<p className="mt-1 text-xs text-slate-300">
							Deletes the matching expense in all remaining months this year (matched by name + category).
						</p>
					</div>
				</div>

				<div className="mt-3 pl-7">
					<label
						className={`flex items-center gap-2 text-xs ${scope.applyRemainingMonths ? "text-slate-200" : "text-slate-500"}`}
					>
						<input
							name="deleteApplyFutureYears"
							type="checkbox"
							disabled={!scope.applyRemainingMonths}
							checked={scope.applyFutureYears}
							onChange={(e) => {
								const next = e.target.checked;
								setScope((s) => ({
									...s,
									applyRemainingMonths: s.applyRemainingMonths || next,
									applyFutureYears: next,
								}));
							}}
							className="h-4 w-4 rounded border-white/20 bg-slate-900/40 text-red-500 focus:ring-red-500/50 disabled:opacity-60"
						/>
						<span>Also delete in future years</span>
					</label>
				</div>
			</div>
		</ConfirmModal>
	);
}
