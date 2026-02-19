"use client";

import { SelectDropdown } from "@/components/Shared";
import { makePaymentFromForm } from "@/lib/debts/actions";
import type { DebtCardDebt } from "@/types/components/debts";

export default function DebtCardRecordPaymentForm(props: {
	debt: DebtCardDebt;
	budgetPlanId: string;
	paymentMonth: string;
	paymentSource: string;
	onPaymentSourceChange: (next: string) => void;
	paymentCardDebtId: string;
	onPaymentCardDebtIdChange: (next: string) => void;
	creditCardOptions: Array<{ value: string; label: string }>;
	defaultPaymentAmount?: number;
}) {
	const {
		debt,
		budgetPlanId,
		paymentMonth,
		paymentSource,
		onPaymentSourceChange,
		paymentCardDebtId,
		onPaymentCardDebtIdChange,
		creditCardOptions,
		defaultPaymentAmount,
	} = props;

	return (
		<div className="bg-slate-900/40 rounded-xl p-2.5 sm:p-4 border border-white/5">
			<h4 className="text-xs sm:text-sm font-semibold text-slate-300 mb-2 sm:mb-3">Record Payment</h4>
			<form
				key={defaultPaymentAmount ?? debt.amount}
				action={makePaymentFromForm}
				className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 sm:gap-3 sm:items-end"
			>
				<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
				<input type="hidden" name="debtId" value={debt.id} />
				<input type="hidden" name="month" value={paymentMonth} />
				<input type="hidden" name="source" value={paymentSource} />
				<input type="hidden" name="cardDebtId" value={paymentCardDebtId} />
				<div>
					<label className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1 sm:mb-1.5">Payment Amount</label>
					<input
						type="number"
						name="amount"
						step="0.01"
						placeholder="Amount"
						defaultValue={defaultPaymentAmount ?? debt.amount}
						required
						aria-label="Payment amount"
						className="h-8 sm:h-10 w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
					/>
				</div>
				<div>
					<label className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1 sm:mb-1.5">Source</label>
					<SelectDropdown
						options={[
							{ value: "income", label: "Income (tracked)" },
							{ value: "extra_funds", label: "Extra funds" },
							{ value: "credit_card", label: "Credit card" },
						]}
						value={paymentSource}
						onValueChange={(next) => {
							onPaymentSourceChange(next);
							if (next !== "credit_card") onPaymentCardDebtIdChange("");
							if (next === "credit_card" && !paymentCardDebtId && creditCardOptions.length === 1) {
								onPaymentCardDebtIdChange(creditCardOptions[0].value);
							}
						}}
						variant="dark"
						buttonClassName="h-8 sm:h-10 text-xs sm:text-sm"
					/>
				</div>

				{paymentSource === "credit_card" ? (
					<div>
						<label className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1 sm:mb-1.5">Card</label>
						<SelectDropdown
							options={[{ value: "", label: "Choose a card" }, ...creditCardOptions]}
							value={paymentCardDebtId}
							onValueChange={onPaymentCardDebtIdChange}
							variant="dark"
							buttonClassName="h-8 sm:h-10 text-xs sm:text-sm"
						/>
					</div>
				) : null}
				<button
					type="submit"
					disabled={paymentSource === "credit_card" && !paymentCardDebtId}
					className="h-8 sm:h-10 px-3 sm:px-6 bg-[var(--cta)] text-white rounded-lg hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] transition-colors font-medium shadow-lg hover:shadow-xl cursor-pointer whitespace-nowrap text-xs sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
				>
					Make Payment
				</button>
			</form>
			<p className="text-[10px] sm:text-xs text-slate-500 mt-2 sm:mt-3">
				💡 <span className="text-amber-400">Income (tracked)</span> payments reduce your available budget for the month.{" "}
				<span className="text-blue-400">Extra funds</span> don&apos;t affect your monthly budget.
			</p>
		</div>
	);
}
