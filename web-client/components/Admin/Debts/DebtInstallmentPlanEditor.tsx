"use client";

import { formatCurrency } from "@/lib/helpers/money";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

const INSTALLMENT_OPTIONS = [0, 2, 3, 4, 6, 8, 9, 12, 18, 24, 30, 36] as const;

export interface DebtInstallmentPlanEditorProps {
	editInstallmentMonths: string;
	editInitialBalance: string;
	editCurrentBalance: string;
	editMonthlyMinimum: string;
	onSelectInstallmentMonths: (months: number) => void;
}

export default function DebtInstallmentPlanEditor({
	editInstallmentMonths,
	editInitialBalance,
	editCurrentBalance,
	editMonthlyMinimum,
	onSelectInstallmentMonths,
}: DebtInstallmentPlanEditorProps) {
	const installmentMonths = editInstallmentMonths ? parseFloat(editInstallmentMonths) : 0;
	const initialBalance = parseFloat(editInitialBalance);
	const currentBalance = parseFloat(editCurrentBalance);
	const monthlyMinimum = editMonthlyMinimum ? parseFloat(editMonthlyMinimum) : 0;
	const principal = Number.isFinite(initialBalance) && initialBalance > 0 ? initialBalance : currentBalance;

	const hasInstallment = installmentMonths > 0 && Number.isFinite(principal) && principal > 0;
	const baseInstallment = hasInstallment ? principal / installmentMonths : 0;
	const minApplies =
		Number.isFinite(monthlyMinimum) && monthlyMinimum > 0 && hasInstallment && monthlyMinimum > baseInstallment;

	return (
		<div className="mb-3 sm:mb-4">
			<label className="block text-[10px] sm:text-xs text-slate-400 mb-1.5 sm:mb-2">
				Installment Plan (spread cost over time)
			</label>
			<div className="flex flex-wrap gap-1.5 sm:gap-2">
				{INSTALLMENT_OPTIONS.map((months) => (
					<button
						key={months}
						type="button"
						onClick={() => onSelectInstallmentMonths(months)}
						className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-all ${
							(months === 0 && !editInstallmentMonths) || editInstallmentMonths === String(months)
								? "bg-purple-500 text-white"
								: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40 border border-white/10"
						}`}
					>
						{months === 0 ? "None" : `${months} months`}
					</button>
				))}
			</div>

			{hasInstallment && (
				<div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
					<div className="text-xs sm:text-sm text-purple-300">
						Installment:{" "}
						<span className="font-bold">
							<Currency value={baseInstallment} />
						</span>{" "}
						per month for {installmentMonths} months
						<div className="text-xs text-slate-400 mt-1">
							💡 &quot;Due This Month&quot; will be auto-calculated based on this plan
						</div>
						{minApplies && (
							<div className="text-xs text-amber-400 mt-2 flex items-start gap-1">
								<span>⚠️</span>
								<span>
									Monthly minimum (£{monthlyMinimum.toFixed(2)}) is higher than installment. The higher amount will be used.
								</span>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
