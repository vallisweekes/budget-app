"use client";

import { SelectDropdown } from "@/components/Shared";
import MoneyInput from "@/components/Shared/MoneyInput";
import type { ExpenseCategoryOption } from "@/types/expenses-manager";

type Props = {
	categories: ExpenseCategoryOption[];
	name: string;
	onNameChange: (value: string) => void;
	amount: string;
	onAmountChange: (value: string) => void;
	categoryId: string;
	onCategoryIdChange: (value: string) => void;
	dueDate: string;
	onDueDateChange: (value: string) => void;
	isAllocation: boolean;
	onIsAllocationChange: (value: boolean) => void;
};

export default function EditExpenseFields({
	categories,
	name,
	onNameChange,
	amount,
	onAmountChange,
	categoryId,
	onCategoryIdChange,
	dueDate,
	onDueDateChange,
	isAllocation,
	onIsAllocationChange,
}: Props) {
	const categoryOptions = [
		...categories.map((c) => ({ value: c.id, label: c.name })),
		{ value: "", label: "Miscellaneous" },
	];

	return (
		   <div className="grid grid-cols-2 gap-4">
			   <label className="block col-span-1">
				   <span className="text-sm font-medium text-slate-300 mb-2 block">Expense Name</span>
				   <input
					   name="name"
					   required
					   value={name}
					   onChange={(e) => onNameChange(e.target.value)}
					   className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
					   placeholder="e.g., Monthly Rent"
				   />
			   </label>
			   <label className="block col-span-1">
				   <span className="text-sm font-medium text-slate-300 mb-2 block">Category</span>
				   <SelectDropdown
					   name="categoryId"
					   value={categoryId}
					   onValueChange={(v) => onCategoryIdChange(v)}
					   placeholder="Select Category"
					   options={categoryOptions}
					   buttonClassName="focus:ring-purple-500/50"
				   />
			   </label>
			   <label className="block col-span-1">
				   <span className="text-sm font-medium text-slate-300 mb-2 block">Amount</span>
				   <MoneyInput name="amount" required value={amount} onChangeValue={onAmountChange} placeholder="0.00" />
			   </label>
			   <label className="block col-span-1">
				   <span className="text-sm font-medium text-slate-300 mb-2 block">Due Date (Day of Month)</span>
				   <input
					   name="dueDate"
					   type="date"
					   value={dueDate}
					   onChange={(e) => onDueDateChange(e.target.value)}
					   className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
					   placeholder="Optional (defaults to pay date)"
				   />
			   </label>
			   <label className="col-span-2 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/30 p-4">
				   <input type="hidden" name="isAllocation" value="false" />
				   <input
					   name="isAllocation"
					   type="checkbox"
					   value="true"
					   checked={isAllocation}
					   onChange={(e) => onIsAllocationChange(e.target.checked)}
					   className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900/40 text-purple-500 focus:ring-purple-500/50"
				   />
				   <div className="min-w-0 flex-1">
					   <div className="text-sm font-semibold text-white">Treat this as an allocation</div>
					   <div className="mt-1 text-xs text-slate-300">
						   Allocation-tagged expenses never convert into debts (useful for envelopes like groceries/transport).
					   </div>
				   </div>
			   </label>
		   </div>
	);
}
