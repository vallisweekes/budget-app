"use client";

import { formatCurrency } from "@/lib/helpers/money";
import type { DebtCardDebt } from "@/types/components/debts";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function DebtCardCollapsedSummary(props: { debt: DebtCardDebt; percentPaid: number }) {
	const { debt, percentPaid } = props;

	const showAvailableToSpend =
		(debt.type === "credit_card" || debt.type === "store_card") &&
		Boolean(debt.creditLimit && debt.creditLimit > 0);
	const availableToSpend = showAvailableToSpend ? Math.max(0, (debt.creditLimit as number) - debt.currentBalance) : 0;

	return (
		<div className="grid grid-cols-2 gap-2 sm:gap-3">
			<div>
				<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5">Current</div>
				<div className="text-sm sm:text-base font-bold text-red-400">
					<Currency value={debt.currentBalance} />
				</div>
				{showAvailableToSpend ? (
					<div className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
						Available to spend: <span className="text-slate-300">{formatCurrency(availableToSpend)}</span>
					</div>
				) : null}
			</div>
			<div className="bg-amber-500/10 rounded-lg p-2 border border-amber-500/20">
				<div className="text-[10px] sm:text-xs text-amber-300 mb-0.5">Due This Month</div>
				<div className="text-sm sm:text-base font-bold text-amber-400">
					<Currency value={debt.amount} />
				</div>
			</div>
			<div className="col-span-2">
				<div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-400 mb-0.5">
					<span>Progress</span>
					<span>{percentPaid.toFixed(0)}% paid</span>
				</div>
				<div className="w-full bg-white/10 rounded-full h-1.5">
					<div
						className="bg-gradient-to-r from-emerald-400 to-green-500 h-1.5 rounded-full transition-all"
						style={{ width: `${Math.min(100, percentPaid)}%` }}
					/>
				</div>
			</div>
		</div>
	);
}
