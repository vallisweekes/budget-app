"use client";

import { InfoTooltip } from "@/components/Shared";
import MonthPreviewForm from "@/components/Admin/Settings/sections/budget/MonthPreviewForm";
import type { MonthSummary } from "@/types/components";
import type { MonthKey } from "@/types";

export default function ZeroBasedSummary({
	monthSummary,
	selectedMonth,
}: {
	monthSummary: MonthSummary;
	selectedMonth: MonthKey;
}) {
	return (
		<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
			<div className="flex items-start justify-between gap-4 mb-6">
				<div>
					<h3 className="text-xl font-bold text-white inline-flex items-center gap-2">
						Zero-based leftover
						<InfoTooltip ariaLabel="Zero-based leftover info" content="Shows what’s still unallocated for the selected month." />
					</h3>
				</div>
				<MonthPreviewForm selectedMonth={selectedMonth} />
			</div>

			<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 mb-5">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Leftover to allocate</p>
						<p className="text-3xl font-extrabold text-white mt-1">£{monthSummary.unallocated.toFixed(2)}</p>
						<p className="text-xs text-slate-500 mt-2">
							Previewing: {selectedMonth} {monthSummary.year}
						</p>
					</div>
					<div className="text-right">
						<p className="text-slate-300 text-sm font-semibold">Tip</p>
						<p className="text-slate-400 text-sm">Adjust Allowance / Savings / Investments until this is £0.</p>
					</div>
				</div>
				<p className="text-xs text-slate-500 mt-3">
					Leftover = Income − Expenses − Debt Payments − Allowance − Savings − Investments
				</p>
			</div>

			<div className="grid grid-cols-2 gap-3 text-sm">
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
					<p className="text-slate-400">Income</p>
					<p className="text-white font-bold">£{monthSummary.incomeTotal.toFixed(2)}</p>
				</div>
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
					<p className="text-slate-400">Expenses</p>
					<p className="text-white font-bold">£{monthSummary.expenseTotal.toFixed(2)}</p>
				</div>
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
					<p className="text-slate-400">Debt payments</p>
					<p className="text-white font-bold">£{monthSummary.debtPaymentsTotal.toFixed(2)}</p>
				</div>
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
					<p className="text-slate-400">Spending (tracked)</p>
					<p className="text-white font-bold">£{monthSummary.spendingTotal.toFixed(2)}</p>
				</div>
			</div>
		</div>
	);
}
