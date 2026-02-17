"use client";

import { Search, X } from "lucide-react";
import type { ExpenseManagerToolbarProps } from "@/types/expenses-manager";

export default function ExpenseManagerToolbar({
	subtitle,
	searchQuery,
	onSearchQueryChange,
	statusFilter,
	onStatusFilterChange,
	minAmountFilter,
	onMinAmountFilterChange,
	showAddForm,
	onToggleAddForm,
	isDisabled,
}: ExpenseManagerToolbarProps) {
	return (
		<div className="space-y-3 sm:space-y-4">
			<div className="flex items-center justify-between gap-2 sm:gap-3">
				<div className="min-w-0 flex-1">
					<h2 className="text-lg sm:text-xl font-bold text-white truncate">Expenses</h2>
					{subtitle ? <p className="text-slate-400 text-xs sm:text-sm mt-0.5">{subtitle}</p> : null}
				</div>
				<button
					disabled={isDisabled}
					onClick={onToggleAddForm}
					className={`bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg sm:rounded-xl py-2 sm:py-3 px-3 sm:px-5 text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
						isDisabled ? "opacity-70 cursor-not-allowed" : ""
					}`}
				>
					{showAddForm ? <X size={16} className="sm:w-[18px] sm:h-[18px]" /> : <span className="text-lg">+</span>}
					<span className="hidden sm:inline">{showAddForm ? "Cancel" : "Add Expense"}</span>
				</button>
			</div>

			<label className="block">
				<span className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5 sm:mb-2">Search</span>
				<div className="relative">
					<Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
					<input
						type="text"
						placeholder="Search expenses by name, amount, or cate"
						value={searchQuery}
						onChange={(e) => onSearchQueryChange(e.target.value)}
						className="w-full pl-9 sm:pl-12 pr-9 sm:pr-10 py-2 sm:py-2.5 text-sm bg-slate-800/40 backdrop-blur-xl border border-white/10 text-white placeholder-slate-400 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => onSearchQueryChange("")}
							className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
							aria-label="Clear search"
						>
							<X size={14} className="sm:w-4 sm:h-4" />
						</button>
					)}
				</div>
			</label>

			<div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
				<span className="text-[10px] sm:text-xs font-medium text-slate-400 mr-0.5 sm:mr-1">Filters:</span>

				{([
					{ key: "all", label: "All", on: "bg-purple-500/20 text-purple-200 border-purple-400/30" },
					{ key: "paid", label: "Paid", on: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30" },
					{ key: "unpaid", label: "Unpaid", on: "bg-red-500/20 text-red-200 border-red-400/30" },
				] as const).map((b) => (
					<button
						key={b.key}
						type="button"
						onClick={() => onStatusFilterChange(b.key)}
						className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border ${
							statusFilter === b.key
								? b.on
								: "bg-slate-900/30 text-slate-300 border-white/10 hover:bg-slate-900/50"
						}`}
					>
						{b.label}
					</button>
				))}

				<span className="text-[10px] sm:text-xs font-medium text-slate-400 mx-0.5 sm:mx-1">Amount:</span>

				{([
					{ value: null, label: "Any" },
					{ value: 100, label: "£100+" },
					{ value: 500, label: "£500+" },
				] as const).map((b) => (
					<button
						key={String(b.value)}
						type="button"
						onClick={() => onMinAmountFilterChange(b.value)}
						className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border ${
							minAmountFilter === b.value
								? "bg-purple-500/20 text-purple-200 border-purple-400/30"
								: "bg-slate-900/30 text-slate-300 border-white/10 hover:bg-slate-900/50"
						}`}
					>
						{b.label}
					</button>
				))}

				{(searchQuery.trim() || statusFilter !== "all" || minAmountFilter != null) && (
					<button
						type="button"
						onClick={() => {
							onSearchQueryChange("");
							onStatusFilterChange("all");
							onMinAmountFilterChange(null);
						}}
						className="ml-auto px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium bg-slate-900/30 text-slate-300 border border-white/10 hover:bg-slate-900/50 transition-all cursor-pointer"
					>
						Clear
					</button>
				)}
			</div>
		</div>
	);
}
