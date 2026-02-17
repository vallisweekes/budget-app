"use client";

import { SelectDropdown } from "@/components/Shared";
import type { ExpenseCategoryOption } from "@/types/expenses-manager";

type Props = {
	categories: ExpenseCategoryOption[];
};

export default function AddExpenseDetailsFields({ categories }: Props) {
	return (
		<>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Expense Name</span>
					<input
						name="name"
						required
						className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
						placeholder="e.g., Monthly Rent"
					/>
				</label>

				<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Amount (£)</span>
					<input
						name="amount"
						type="number"
						step="0.01"
						required
						className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
						placeholder="0.00"
					/>
				</label>

				<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Category</span>
					<SelectDropdown
						name="categoryId"
						placeholder="Select Category"
						options={[
							...categories.map((c) => ({ value: c.id, label: c.name })),
							{ value: "", label: "Miscellaneous" },
						]}
						buttonClassName="focus:ring-purple-500/50"
					/>
				</label>

				<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Payment Status</span>
					<SelectDropdown
						name="paid"
						defaultValue="false"
						options={[
							{ value: "false", label: "Not Paid" },
							{ value: "true", label: "Paid" },
						]}
						buttonClassName="focus:ring-purple-500/50"
					/>
				</label>
			</div>

			<label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/30 p-4">
				<input type="hidden" name="isAllocation" value="false" />
				<input
					name="isAllocation"
					type="checkbox"
					value="true"
					className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900/60 text-purple-500 focus:ring-purple-500"
				/>
				<div className="min-w-0 flex-1">
					<div className="text-sm font-semibold text-white">Treat this as an allocation</div>
					<div className="mt-1 text-xs text-slate-300">Use this for envelopes like groceries/transport so they never appear as debts.</div>
				</div>
			</label>
		</>
	);
}
