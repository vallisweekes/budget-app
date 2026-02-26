"use client";

import { Plus } from "lucide-react";

import type { MonthKey } from "@/types";

import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";

export default function CategoryInlineAdd({
	open,
	error,
	isBusy,
	onOpen,
	onCancel,
	onSubmit,
	budgetPlanId,
	month,
	year,
	categoryId,
	categoryName,
}: {
	open: boolean;
	error?: string | null;
	isBusy?: boolean;
	onOpen: () => void;
	onCancel: () => void;
	onSubmit: (data: FormData) => void;
	budgetPlanId: string;
	month: MonthKey;
	year: number;
	categoryId: string;
	categoryName: string;
}) {
	return (
		<div className="p-2 sm:p-4 bg-slate-900/20">
			{open ? (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						const data = new FormData(e.currentTarget);
						onSubmit(data);
					}}
					className="space-y-2"
				>
					<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
					<input type="hidden" name="month" value={month} />
					<input type="hidden" name="year" value={year} />
					<input type="hidden" name="categoryId" value={categoryId} />
					<input type="hidden" name="paid" value="false" />

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
						<input
							name="name"
							required
							className="sm:col-span-2 w-full px-3 py-2 rounded-xl border border-white/10 bg-slate-900/40 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all"
							placeholder={`Add to ${categoryName}…`}
						/>
						<input
							name="amount"
							type="number"
							step="0.01"
							required
							className="w-full px-3 py-2 rounded-xl border border-white/10 bg-slate-900/40 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all"
							placeholder="0.00"
						/>
					</div>

					<div className="flex items-center justify-end gap-2">
						<button
							type="button"
							onClick={onCancel}
							className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 border border-white/10 bg-white/5 hover:bg-white/10 transition"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isBusy}
							className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-emerald-400/30 bg-emerald-500/20 hover:bg-emerald-500/30 transition disabled:opacity-60"
						>
							<Plus size={14} />
							{isBusy ? "Adding…" : "Add"}
						</button>
					</div>

					{error ? <p className="text-xs text-red-200">{error}</p> : null}
				</form>
			) : (
				<div className="flex items-center justify-between gap-2">
					<div className="text-[10px] sm:text-xs text-slate-400">
						Add a new expense for {formatMonthKeyLabel(month)} {year}
					</div>
					<button
						type="button"
						onClick={onOpen}
						className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-semibold text-white border border-white/10 bg-white/5 hover:bg-white/10 transition"
					>
						<Plus size={14} />
						Add expense
					</button>
				</div>
			)}
		</div>
	);
}
