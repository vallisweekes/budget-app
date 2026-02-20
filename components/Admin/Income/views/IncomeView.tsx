import type { MonthKey } from "@/types";
import type { IncomeByMonth } from "@/types/components/income";

import { MONTHS } from "@/lib/constants/time";
import IncomeYearPicker from "@/components/Admin/Income/IncomeYearPicker";
import { MonthlyIncomeGrid } from "@/components/Admin/Income/MonthlyIncomeGrid";

export default function IncomeView({
	budgetPlanId,
	showYearPicker,
	allYears,
	selectedIncomeYear,
	hasAvailableMonths: _hasAvailableMonths,
	defaultMonth: _defaultMonth,
	monthsWithoutIncome: _monthsWithoutIncome,
	income,
}: {
	budgetPlanId: string;
	showYearPicker: boolean;
	allYears: number[];
	selectedIncomeYear: number;
	hasAvailableMonths: boolean;
	defaultMonth: MonthKey;
	monthsWithoutIncome: MonthKey[];
	income: IncomeByMonth;
}) {
	return (
		<div className="space-y-8">
			{showYearPicker ? (
				<div className="flex items-end justify-between gap-3">
					<div className="text-xs text-slate-400">Viewing income for year</div>
					<IncomeYearPicker years={allYears} selectedYear={selectedIncomeYear} className="w-40" />
				</div>
			) : null}

			<div className="space-y-4 sm:space-y-6">
				<div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
					<div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
						<svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
					</div>
					<div>
						<h2 className="text-lg sm:text-2xl font-bold text-white">Monthly Income</h2>
						<p className="text-slate-400 text-xs sm:text-sm">Tap a month to view and manage income sources</p>
					</div>
				</div>

				<MonthlyIncomeGrid
					months={MONTHS}
					income={income}
					budgetPlanId={budgetPlanId}
					year={selectedIncomeYear}
					variant="preview"
				/>
			</div>
		</div>
	);
}
