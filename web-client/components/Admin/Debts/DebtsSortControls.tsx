"use client";

import { ArrowUpAZ, ArrowUpDown, DollarSign } from "lucide-react";

import type { DebtSortOption } from "@/lib/helpers/debts/listItems";

export default function DebtsSortControls(props: {
	sortBy: DebtSortOption;
	onSortChange: (next: DebtSortOption) => void;
}) {
	const { sortBy, onSortChange } = props;

	return (
		<div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
			<span className="text-xs sm:text-sm text-slate-400">Sort by:</span>
			<div className="flex gap-1.5 sm:gap-2">
				<button
					onClick={() => onSortChange("default")}
					className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-1.5 ${
						sortBy === "default"
							? "bg-purple-600 text-white"
							: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40"
					}`}
				>
					<ArrowUpDown className="w-3 h-3 sm:w-4 sm:h-4" />
					Default
				</button>
				<button
					onClick={() => onSortChange("name")}
					className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-1.5 ${
						sortBy === "name"
							? "bg-purple-600 text-white"
							: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40"
					}`}
				>
					<ArrowUpAZ className="w-3 h-3 sm:w-4 sm:h-4" />
					Name
				</button>
				<button
					onClick={() => onSortChange("amount")}
					className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-1.5 ${
						sortBy === "amount"
							? "bg-purple-600 text-white"
							: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40"
					}`}
				>
					<DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
					Amount
				</button>
			</div>
		</div>
	);
}
