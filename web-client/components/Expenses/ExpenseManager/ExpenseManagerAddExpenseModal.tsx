"use client";

import type { ComponentProps } from "react";

import { X } from "lucide-react";

import AddExpenseForm from "@/components/Expenses/ExpenseManager/AddExpenseForm";

type AddExpenseFormProps = ComponentProps<typeof AddExpenseForm>;

export default function ExpenseManagerAddExpenseModal({
	open,
	onRequestClose,
	formProps,
}: {
	open: boolean;
	onRequestClose: () => void;
	formProps: AddExpenseFormProps;
}) {
	if (!open) return null;

	const isBusy = Boolean(formProps.isBusy);

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-6 overscroll-contain">
			<button
				type="button"
				className="fixed inset-0 bg-black/60 backdrop-blur-sm"
				onClick={() => {
					if (!isBusy) onRequestClose();
				}}
				aria-label="Close add expense"
			/>
			<div className="relative z-10 my-auto w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<div className="relative">
					<button
						type="button"
						onClick={() => {
							if (!isBusy) onRequestClose();
						}}
						disabled={isBusy}
						className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 text-slate-200 hover:bg-white/10 disabled:opacity-60"
						title="Close"
					>
						<X size={18} />
					</button>

					<AddExpenseForm {...formProps} />
				</div>
			</div>
		</div>
	);
}
