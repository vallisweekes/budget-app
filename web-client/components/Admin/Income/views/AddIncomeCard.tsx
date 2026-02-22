import { addIncomeAction } from "@/lib/income/actions";
import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";

import { SelectDropdown } from "@/components/Shared";

export default function AddIncomeCard({
	budgetPlanId,
	year,
	defaultMonth,
	monthsWithoutIncome,
}: {
	budgetPlanId: string;
	year: number;
	defaultMonth: MonthKey;
	monthsWithoutIncome: MonthKey[];
}) {
	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
			<div className="flex items-center gap-3 mb-8">
				<div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
					<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
					</svg>
				</div>
				<div>
					<h2 className="text-2xl font-bold text-white">Add Income</h2>
					<p className="text-slate-400 text-sm">Only shows months that don’t have income yet (Year {year}).</p>
				</div>
			</div>

			<form action={addIncomeAction} className="grid grid-cols-1 md:grid-cols-12 gap-4">
				<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
				<input type="hidden" name="year" value={year} />
				<label className="md:col-span-3">
					<span className="block text-sm font-medium text-slate-300 mb-2">Month</span>
					<SelectDropdown
						name="month"
						defaultValue={defaultMonth}
						options={monthsWithoutIncome.map((m) => ({ value: m, label: formatMonthKeyLabel(m) }))}
						buttonClassName="bg-slate-900/60 focus:ring-amber-500"
					/>
				</label>
				<label className="md:col-span-5">
					<span className="block text-sm font-medium text-slate-300 mb-2">Income Name</span>
					<input
						name="name"
						placeholder="e.g., Salary, Freelance Work"
						className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
					/>
				</label>
				<label className="md:col-span-3">
					<span className="block text-sm font-medium text-slate-300 mb-2">Amount (£)</span>
					<input
						name="amount"
						type="number"
						step="0.01"
						placeholder="0.00"
						className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
					/>
				</label>
				<div className="md:col-span-11 flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
					<label className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 select-none">
						<input
							type="checkbox"
							name="distributeMonths"
							className="h-4 w-4 rounded border-white/20 bg-slate-900/60 text-amber-500 focus:ring-amber-500"
						/>
						Distribute across all months
					</label>
					<label className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 select-none">
						<input
							type="checkbox"
							name="distributeYears"
							className="h-4 w-4 rounded border-white/20 bg-slate-900/60 text-amber-500 focus:ring-amber-500"
						/>
						Distribute across all budgets
					</label>
				</div>
				<div className="md:col-span-1 flex items-end">
					<button
						type="submit"
						className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
					>
						Add
					</button>
				</div>
			</form>
		</div>
	);
}
