"use client";

import { Check, X } from "lucide-react";
import type { IncomeItem } from "@/types";

export default function IncomeItemEditForm(props: {
	item: IncomeItem;
	editName: string;
	editAmount: string;
	isPending: boolean;
	onEditNameChange: (next: string) => void;
	onEditAmountChange: (next: string) => void;
	onSubmit: () => void;
	onCancel: () => void;
}) {
	const {
		item,
		editName,
		editAmount,
		isPending,
		onEditNameChange,
		onEditAmountChange,
		onSubmit,
		onCancel,
	} = props;

	return (
		<form
			className="w-full flex items-center gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit();
			}}
		>
			<label className="flex-1">
				<span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-0.5 sm:mb-1">
					Name
				</span>
				<input
					type="text"
					value={editName}
					onChange={(e) => onEditNameChange(e.target.value)}
					disabled={isPending}
					className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-70"
					placeholder="Name"
					aria-label={`Edit income name for ${item.name}`}
				/>
			</label>
			<label className="w-24 sm:w-28">
				<span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-0.5 sm:mb-1">
					Amount
				</span>
				<input
					type="number"
					step="0.01"
					value={editAmount}
					onChange={(e) => onEditAmountChange(e.target.value)}
					disabled={isPending}
					className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-70"
					placeholder="Amount"
					aria-label={`Edit income amount for ${item.name}`}
				/>
			</label>
			<div className="flex items-center gap-2">
				<button
					type="submit"
					disabled={isPending}
					className="p-1 sm:p-1.5 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
					aria-label={`Save edits for ${item.name}`}
				>
					<Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
				</button>
				<button
					type="button"
					onClick={onCancel}
					disabled={isPending}
					className="p-1 sm:p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
					aria-label={`Cancel edits for ${item.name}`}
				>
					<X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
				</button>
			</div>
		</form>
	);
}
