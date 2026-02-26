"use client";

import { formatCurrency } from "@/lib/helpers/money";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

const INSTALLMENT_OPTIONS = [0, 2, 3, 4, 6, 8, 9, 12, 18, 24, 30, 36] as const;

export default function InstallmentPlanSection({
	installmentMonths,
	onInstallmentMonthsChange,
	initialBalance,
}: {
	installmentMonths: string;
	onInstallmentMonthsChange: (value: string) => void;
	initialBalance: string;
}) {
	const monthsNumber = Number(installmentMonths);
	const initialBalanceNumber = Number(initialBalance);
	const showPreview =
		Boolean(installmentMonths) && Number.isFinite(monthsNumber) && monthsNumber > 0 && initialBalanceNumber > 0;

	return (
		<div>
			<label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5 sm:mb-2">
				Installment Plan (Optional)
			</label>
			<div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
				{INSTALLMENT_OPTIONS.map((months) => (
					<button
						key={months}
						type="button"
						onClick={() => onInstallmentMonthsChange(months === 0 ? "" : String(months))}
						className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-all ${
							(months === 0 && !installmentMonths) || installmentMonths === String(months)
								? "bg-purple-500 text-white"
								: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40 border border-white/10"
						}`}
					>
						{months === 0 ? "None" : `${months} months`}
					</button>
				))}
			</div>
			<input type="hidden" name="installmentMonths" value={installmentMonths} />

			{showPreview ? (
				<div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
					<div className="text-sm text-purple-300">
						💡 Payment will be spread over {installmentMonths} months:{" "}
						<span className="font-bold">
							<Currency value={initialBalanceNumber / monthsNumber} />
						</span>{" "}
						per month
					</div>
				</div>
			) : null}
		</div>
	);
}
