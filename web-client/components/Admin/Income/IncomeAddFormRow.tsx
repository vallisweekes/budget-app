"use client";

import { Check, X } from "lucide-react";

export default function IncomeAddFormRow(props: {
	newName: string;
	newAmount: string;
	distributeAllMonths: boolean;
	distributeAllYears: boolean;
	isPending: boolean;
	isCurrentMonth: boolean;
	onNewNameChange: (next: string) => void;
	onNewAmountChange: (next: string) => void;
	onDistributeAllMonthsChange: (next: boolean) => void;
	onDistributeAllYearsChange: (next: boolean) => void;
	onConfirmAdd: () => void;
	onCancel: () => void;
}) {
	const {
		newName,
		newAmount,
		distributeAllMonths,
		distributeAllYears,
		isPending,
		isCurrentMonth,
		onNewNameChange,
		onNewAmountChange,
		onDistributeAllMonthsChange,
		onDistributeAllYearsChange,
		onConfirmAdd,
		onCancel,
	} = props;

	return (
		<div className="p-1.5 sm:p-2 bg-slate-900/40 rounded-lg border border-white/10">
			<div className="flex items-center gap-2">
				<label className="flex-1">
					<span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-0.5 sm:mb-1">
						Name
					</span>
					<input
						type="text"
						value={newName}
						onChange={(e) => onNewNameChange(e.target.value)}
						disabled={isPending}
						className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-70"
						placeholder="Income name"
						aria-label="New income name"
						autoFocus
					/>
				</label>
				<label className="w-24 sm:w-28">
					<span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-0.5 sm:mb-1">
						Amount
					</span>
					<input
						type="number"
						step="0.01"
						value={newAmount}
						onChange={(e) => onNewAmountChange(e.target.value)}
						disabled={isPending}
						className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-70"
						placeholder="Amount"
						aria-label="New income amount"
					/>
				</label>
				{isPending && (
					<div className="flex items-center gap-2 text-xs text-slate-300 px-2" aria-live="polite">
						<span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400/60 border-t-transparent animate-spin" />
						Saving…
					</div>
				)}
				<button
					type="button"
					onClick={onConfirmAdd}
					disabled={isPending}
					className="p-1.5 sm:p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					title="Add"
				>
					<Check size={16} />
				</button>
				<button
					type="button"
					onClick={onCancel}
					disabled={isPending}
					className="p-1.5 sm:p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					title="Cancel"
				>
					<X size={16} />
				</button>
			</div>

			<div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] sm:text-xs text-slate-300">
				<label className="flex items-center gap-2 select-none">
					<input
						type="checkbox"
						checked={distributeAllMonths}
						onChange={(e) => onDistributeAllMonthsChange(e.target.checked)}
						disabled={isPending}
						className={`h-4 w-4 rounded border-white/20 bg-slate-900/60 ${
							isCurrentMonth ? "text-teal-300 focus:ring-teal-300" : "text-purple-500 focus:ring-purple-500"
						}`}
					/>
					All months
				</label>
				<label className="flex items-center gap-2 select-none">
					<input
						type="checkbox"
						checked={distributeAllYears}
						onChange={(e) => onDistributeAllYearsChange(e.target.checked)}
						disabled={isPending}
						className={`h-4 w-4 rounded border-white/20 bg-slate-900/60 ${
							isCurrentMonth ? "text-teal-300 focus:ring-teal-300" : "text-purple-500 focus:ring-purple-500"
						}`}
					/>
					All budgets
				</label>
			</div>
		</div>
	);
}
