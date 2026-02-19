"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/helpers/money";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function DebtCardEditDetails(props: {
	debtType: string;
	creditLimit: string;
	editInitialBalance: string;
	editCurrentBalance: string;
	editDueAmount: string;
	editMonthlyMinimum: string;
	editInterestRate: string;
	editInstallmentMonths: string;
	onEditInitialBalanceChange: (next: string) => void;
	onEditCurrentBalanceChange: (next: string) => void;
	onEditDueAmountChange: (next: string) => void;
	onEditMonthlyMinimumChange: (next: string) => void;
	onEditInterestRateChange: (next: string) => void;
	onSelectInstallmentMonths: (months: number) => void;
	editDueDate: string;
	onEditDueDateChange: (next: string) => void;
	editDefaultPaymentSource: string;
	onEditDefaultPaymentSourceChange: (next: string) => void;
	editDefaultPaymentCardDebtId: string;
	onEditDefaultPaymentCardDebtIdChange: (next: string) => void;
	creditCardOptions?: Array<{ value: string; label: string }>;
}) {
	const {
		debtType,
		creditLimit,
		editInitialBalance,
		editCurrentBalance,
		editDueAmount,
		editMonthlyMinimum,
		editInterestRate,
		editInstallmentMonths,
		onEditInitialBalanceChange,
		onEditCurrentBalanceChange,
		onEditDueAmountChange,
		onEditMonthlyMinimumChange,
		onEditInterestRateChange,
		onSelectInstallmentMonths,
		editDueDate,
		onEditDueDateChange,
		editDefaultPaymentSource,
		onEditDefaultPaymentSourceChange,
		editDefaultPaymentCardDebtId,
		onEditDefaultPaymentCardDebtIdChange,
		creditCardOptions,
	} = props;

	const installmentMonths = editInstallmentMonths ? parseFloat(editInstallmentMonths) : 0;
	const currentBalance = parseFloat(editCurrentBalance);
	const monthlyMinimum = editMonthlyMinimum ? parseFloat(editMonthlyMinimum) : 0;

	const hasInstallment = installmentMonths > 0 && Number.isFinite(currentBalance) && currentBalance > 0;
	const baseInstallment = hasInstallment ? currentBalance / installmentMonths : 0;
	const minApplies =
		Number.isFinite(monthlyMinimum) && monthlyMinimum > 0 && hasInstallment && monthlyMinimum > baseInstallment;

	return (
		<>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
				<div>
					<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Due Date</label>
					<input
						type="date"
						value={editDueDate}
						onChange={(e) => onEditDueDateChange(e.target.value)}
						className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
					/>
					<div className="mt-1 text-[10px] sm:text-xs text-slate-500">
						A payment is treated as <span className="text-slate-300">missed</span> once it’s more than 5 days past this date.
					</div>
				</div>

				<div>
					<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Default Payment Source</label>
					<select
						value={editDefaultPaymentSource}
						onChange={(e) => onEditDefaultPaymentSourceChange(e.target.value)}
						className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
					>
						<option value="income">Income (tracked)</option>
						<option value="extra_funds">Extra funds</option>
						<option value="credit_card">Credit card</option>
					</select>
				</div>

				{editDefaultPaymentSource === "credit_card" ? (
					<div>
						<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Default Card</label>
						<select
							value={editDefaultPaymentCardDebtId}
							onChange={(e) => onEditDefaultPaymentCardDebtIdChange(e.target.value)}
							required
							className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
						>
							<option value="">Choose a card</option>
							{(creditCardOptions ?? []).map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>
				) : null}
			</div>

			{debtType === "credit_card" || debtType === "store_card" ? (
				<div className="mb-3 sm:mb-4">
					<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Credit Limit</label>
					<input
						type="number"
						step="0.01"
						min={0}
						value={creditLimit}
						disabled
						readOnly
						className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/30 border border-white/10 text-slate-300 placeholder-slate-600 rounded-lg opacity-80 cursor-not-allowed text-xs sm:text-sm"
						placeholder="e.g. 1200.00"
					/>
					<div className="mt-1 text-[10px] sm:text-xs text-slate-500">
						Credit limits are read-only here. Edit in{" "}
						<Link href="/admin/settings" className="text-purple-300 hover:text-purple-200 underline underline-offset-2">
							Settings → Savings and Cards
						</Link>
						.
					</div>
				</div>
			) : null}

			<div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-4 mb-3 sm:mb-4">
				<div>
					<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Initial Balance</label>
					<input
						type="number"
						step="0.01"
						value={editInitialBalance}
						onChange={(e) => onEditInitialBalanceChange(e.target.value)}
						className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
						placeholder="Initial balance"
					/>
					<div className="mt-1 text-[10px] sm:text-xs text-slate-500">
						Starting amount when you added the debt (can increase if missed payments roll over).
					</div>
				</div>
				<div>
					<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Current Balance</label>
					<input
						type="number"
						step="0.01"
						value={editCurrentBalance}
						onChange={(e) => onEditCurrentBalanceChange(e.target.value)}
						className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
						placeholder="Current balance"
					/>
					<div className="mt-1 text-[10px] sm:text-xs text-slate-500">What you still owe right now.</div>
				</div>
				<div>
					<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Due This Month</label>
					<input
						type="number"
						step="0.01"
						value={editDueAmount}
						onChange={(e) => onEditDueAmountChange(e.target.value)}
						className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
						placeholder="Payment amount"
					/>
				</div>
				<div>
					<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Monthly Minimum</label>
					<input
						type="number"
						step="0.01"
						value={editMonthlyMinimum}
						onChange={(e) => onEditMonthlyMinimumChange(e.target.value)}
						className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
						placeholder="Optional"
					/>
				</div>
				<div>
					<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Interest Rate (%)</label>
					<input
						type="number"
						step="0.01"
						value={editInterestRate}
						onChange={(e) => onEditInterestRateChange(e.target.value)}
						className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
						placeholder="Optional"
					/>
				</div>
			</div>

			<div className="mb-3 sm:mb-4">
				<label className="block text-[10px] sm:text-xs text-slate-400 mb-1.5 sm:mb-2">
					Installment Plan (spread cost over time)
				</label>
				<div className="flex flex-wrap gap-1.5 sm:gap-2">
					{[0, 2, 3, 4, 6, 8, 9, 12, 18, 24, 30, 36].map((months) => (
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
							<div className="text-xs text-slate-400 mt-1">💡 &quot;Due This Month&quot; will be auto-calculated based on this plan</div>
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
		</>
	);
}
