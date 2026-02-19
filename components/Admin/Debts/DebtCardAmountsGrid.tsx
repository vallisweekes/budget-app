"use client";

import { Check, Pencil, X } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/money";
import type { DebtCardDebt } from "@/types/components/debts";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function DebtCardAmountsGrid(props: {
	debt: DebtCardDebt;
	displayDueAmount?: number;
	displayDueNote?: string;
	isEditingAmount: boolean;
	tempDueAmount: string;
	onTempDueAmountChange: (next: string) => void;
	onEditingAmountChange: (next: boolean) => void;
	onSaveDueAmount: () => void;
	isPending: boolean;
}) {
	const {
		debt,
		displayDueAmount,
		displayDueNote,
		isEditingAmount,
		tempDueAmount,
		onTempDueAmountChange,
		onEditingAmountChange,
		onSaveDueAmount,
		isPending,
	} = props;

	const showAvailableToSpend =
		(debt.type === "credit_card" || debt.type === "store_card") &&
		Boolean(debt.creditLimit && debt.creditLimit > 0);
	const creditLimit = showAvailableToSpend ? (debt.creditLimit as number) : 0;
	const availableToSpend = showAvailableToSpend ? Math.max(0, creditLimit - debt.currentBalance) : 0;

	return (
		<div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-4 mb-3 sm:mb-4">
			<div>
				<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Current Balance</div>
				<div className="text-lg sm:text-xl font-bold text-red-400">
					<Currency value={debt.currentBalance} />
				</div>
				{showAvailableToSpend ? (
					<div className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
						Available to spend: <span className="text-slate-300">{formatCurrency(availableToSpend)}</span>
					</div>
				) : null}
			</div>

			{showAvailableToSpend ? (
				<div>
					<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Credit Limit</div>
					<div className="text-base sm:text-lg font-semibold text-slate-300">
						<Currency value={creditLimit} />
					</div>
				</div>
			) : null}

			<div>
				<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Initial Balance</div>
				<div className="text-base sm:text-lg font-semibold text-slate-300">
					<Currency value={debt.initialBalance} />
				</div>
			</div>
			<div className="bg-amber-500/10 rounded-lg p-2 sm:p-3 border border-amber-500/20">
				<div className="text-[10px] sm:text-xs text-amber-300 mb-0.5 sm:mb-1 font-medium flex items-center justify-between">
					<span>Due This Month</span>
					{!isEditingAmount ? (
						<button
							onClick={() => {
								onTempDueAmountChange(String(debt.amount));
								onEditingAmountChange(true);
							}}
							className="p-0.5 sm:p-1 rounded hover:bg-amber-500/20 transition-colors"
							title="Edit amount"
						>
							<Pencil size={10} className="sm:w-3 sm:h-3 text-amber-300" />
						</button>
					) : null}
				</div>
				{isEditingAmount ? (
					<div className="flex items-center gap-2.5 sm:gap-3">
						<input
							type="number"
							step="0.01"
							value={tempDueAmount}
							onChange={(e) => onTempDueAmountChange(e.target.value)}
							className="flex-1 min-w-0 px-2 py-1 sm:px-3 sm:py-1 bg-slate-900/60 border border-amber-500/30 text-amber-400 rounded text-base sm:text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
							autoFocus
						/>
						<button
							onClick={onSaveDueAmount}
							disabled={isPending}
							className="p-0.5 sm:p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-60"
							title="Save"
						>
							<Check size={12} className="sm:w-[14px] sm:h-[14px]" />
						</button>
						<button
							onClick={() => onEditingAmountChange(false)}
							disabled={isPending}
							className="p-0.5 sm:p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-60"
							title="Cancel"
						>
							<X size={12} className="sm:w-[14px] sm:h-[14px]" />
						</button>
					</div>
				) : (
					<>
						<div className="text-xl font-bold text-amber-400">
							<Currency value={displayDueAmount ?? debt.amount} />
						</div>
						{displayDueNote ? <div className="text-[10px] sm:text-xs text-amber-200/80 mt-0.5">{displayDueNote}</div> : null}
					</>
				)}
			</div>
			{debt.monthlyMinimum && (
				<div>
					<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Monthly Minimum</div>
					<div className="text-base sm:text-lg font-semibold text-slate-300">
						<Currency value={debt.monthlyMinimum} />
					</div>
				</div>
			)}
			{debt.interestRate && (
				<div>
					<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Interest Rate</div>
					<div className="text-base sm:text-lg font-semibold text-slate-300">{debt.interestRate}%</div>
				</div>
			)}
		</div>
	);
}
