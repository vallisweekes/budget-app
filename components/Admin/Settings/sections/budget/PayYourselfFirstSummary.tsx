"use client";

import MonthPreviewForm from "@/components/Admin/Settings/sections/budget/MonthPreviewForm";
import type { MonthSummary } from "@/types/components";
import type { MonthKey } from "@/types";

export default function PayYourselfFirstSummary({
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
					<h3 className="text-xl font-bold text-white">Pay yourself first</h3>
					<p className="text-slate-400 text-sm">Prioritise savings/investments and debt payments, then spend what&apos;s left.</p>
				</div>
				<MonthPreviewForm selectedMonth={selectedMonth} />
			</div>

			<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 mb-5">
				<p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Left after paying yourself first</p>
				<p className="text-3xl font-extrabold text-white mt-1">£{monthSummary.unallocated.toFixed(2)}</p>
				<p className="text-xs text-slate-500 mt-2">
					Previewing: {selectedMonth} {monthSummary.year}
				</p>
				<p className="text-slate-400 text-sm mt-2">Increase Savings/Investments if you want to prioritise future goals.</p>
			</div>

			<div className="grid grid-cols-2 gap-3 text-sm">
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
					<p className="text-slate-400">Savings (planned)</p>
					<p className="text-white font-bold">£{monthSummary.plannedSavings.toFixed(2)}</p>
				</div>
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
					<p className="text-slate-400">Investments (planned)</p>
					<p className="text-white font-bold">£{monthSummary.plannedInvestments.toFixed(2)}</p>
				</div>
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
					<p className="text-slate-400">Debt payments</p>
					<p className="text-white font-bold">£{monthSummary.debtPaymentsTotal.toFixed(2)}</p>
				</div>
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
					<p className="text-slate-400">Expenses</p>
					<p className="text-white font-bold">£{monthSummary.expenseTotal.toFixed(2)}</p>
				</div>
			</div>
		</div>
	);
}
