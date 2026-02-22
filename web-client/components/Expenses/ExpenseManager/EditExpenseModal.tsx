"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { MonthKey } from "@/types";
import { MONTHS } from "@/lib/constants/time";
import { getDueDateUtc } from "@/lib/helpers/expenses/dueDate";
import type { ExpenseCategoryOption, EditExpenseModalProps } from "@/types/expenses-manager";
import EditExpenseFields from "@/components/Expenses/ExpenseManager/EditExpenseFields";
import EditExpenseApplyScope from "@/components/Expenses/ExpenseManager/EditExpenseApplyScope";

function asIsoDate(value: string | undefined): string {
	if (!value) return "";
	return value.length >= 10 ? value.slice(0, 10) : value;
}

export default function EditExpenseModal({
	open,
	budgetPlanId,
	month,
	year,
	payDate,
	categories,
	expense,
	isBusy,
	onClose,
	onSubmit,
}: EditExpenseModalProps) {
	const [name, setName] = useState("");
	const [amount, setAmount] = useState<string>("");
	const [categoryId, setCategoryId] = useState<string>("");
	const [dueDate, setDueDate] = useState<string>("");
	const [isAllocation, setIsAllocation] = useState(false);
	const [applyRemainingMonths, setApplyRemainingMonths] = useState(false);
	const [applyFutureYears, setApplyFutureYears] = useState(false);

	const monthNumber = useMemo(() => (MONTHS as MonthKey[]).indexOf(month) + 1, [month]);

	useEffect(() => {
		if (!expense) return;
		setName(expense.name);
		setAmount(String(expense.amount));
		setCategoryId(expense.categoryId ?? "");
		setIsAllocation(Boolean(expense.isAllocation));
		setApplyRemainingMonths(false);
		setApplyFutureYears(false);

		const rawDue = asIsoDate(expense.dueDate);
		if (rawDue) {
			setDueDate(rawDue);
			return;
		}
		const defaultDueUtc = getDueDateUtc({ year, monthNumber, payDate });
		setDueDate(defaultDueUtc.toISOString().slice(0, 10));
	}, [expense, monthNumber, payDate, year]);

	if (!open || !expense) return null;

	return (
		<div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 py-6 overscroll-contain">
			<button
				type="button"
				className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
				onClick={() => {
					if (!isBusy) onClose();
				}}
				aria-label="Close dialog"
			/>

			<div
				role="dialog"
				aria-modal="true"
				className="relative z-10 my-auto w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-white/10 bg-slate-800/50 backdrop-blur-xl shadow-2xl"
			>
				<div className="p-6">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h2 className="text-xl font-bold text-white">Edit expense</h2>
							<p className="mt-1 text-sm text-slate-300">Update the name, amount, or category. Payments remain intact.</p>
						</div>
						<button
							type="button"
							onClick={() => {
								if (!isBusy) onClose();
							}}
							className="h-10 w-10 rounded-xl border border-white/10 bg-slate-900/30 text-slate-200 hover:bg-slate-900/50 transition-all"
							aria-label="Close"
							disabled={isBusy}
						>
							<X size={18} className="mx-auto" />
						</button>
					</div>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							onSubmit(new FormData(e.currentTarget));
						}}
						className="mt-6 space-y-5"
					>
						<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
						<input type="hidden" name="month" value={month} />
						<input type="hidden" name="year" value={year} />
						<input type="hidden" name="id" value={expense.id} />

						<EditExpenseFields
							categories={categories}
							name={name}
							onNameChange={setName}
							amount={amount}
							onAmountChange={setAmount}
							categoryId={categoryId}
							onCategoryIdChange={setCategoryId}
							dueDate={dueDate}
							onDueDateChange={setDueDate}
							isAllocation={isAllocation}
							onIsAllocationChange={setIsAllocation}
						/>

						<EditExpenseApplyScope
							applyRemainingMonths={applyRemainingMonths}
							setApplyRemainingMonths={(next) => {
								setApplyRemainingMonths(next);
								if (!next) setApplyFutureYears(false);
							}}
							applyFutureYears={applyFutureYears}
							setApplyFutureYears={(next) => {
								setApplyFutureYears(next);
								if (next) setApplyRemainingMonths(true);
							}}
						/>

						<div className="flex items-center justify-end gap-3 pt-2">
							<button
								type="button"
								onClick={onClose}
								disabled={isBusy}
								className="h-10 px-4 rounded-xl border border-white/10 bg-slate-900/40 text-slate-200 hover:bg-slate-900/60 transition-all disabled:opacity-50"
							>
								Cancel
							</button>

							<button
								type="submit"
								disabled={isBusy}
								className="h-10 px-4 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] disabled:opacity-50"
							>
								{isBusy ? "Saving…" : "Save changes"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
