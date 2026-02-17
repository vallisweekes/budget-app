"use client";

import { formatCurrency } from "@/lib/helpers/money";
import type { DebtCardDebt } from "./debtCardTypes";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function DebtCardInstallmentSummary(props: {
	debt: DebtCardDebt;
	effectiveMonthlyPayment: number;
}) {
	const { debt, effectiveMonthlyPayment } = props;

	if (!debt.installmentMonths || debt.currentBalance <= 0) return null;

	return (
		<div className="mb-3 sm:mb-4 p-2.5 sm:p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
			<div className="flex items-center justify-between">
				<div>
					<div className="text-[10px] sm:text-xs text-purple-300 mb-0.5 sm:mb-1">Installment Plan Active</div>
					<div className="text-base sm:text-lg font-bold text-purple-400">
						<Currency value={effectiveMonthlyPayment} /> / month
					</div>
					<div className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
						for {debt.installmentMonths} months
						{debt.monthlyMinimum &&
							effectiveMonthlyPayment > debt.currentBalance / debt.installmentMonths && (
								<span className="block text-amber-400 mt-1">
									⚠️ Monthly minimum (£{debt.monthlyMinimum.toFixed(2)}) applied
								</span>
							)}
					</div>
				</div>
				<div className="text-right">
					<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Remaining</div>
					<div className="text-xs sm:text-sm font-semibold text-slate-300">
						<Currency value={debt.currentBalance} />
					</div>
				</div>
			</div>
		</div>
	);
}
