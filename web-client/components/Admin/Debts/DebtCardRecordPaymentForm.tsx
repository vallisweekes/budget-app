"use client";

import { useState } from "react";

import { SelectDropdown } from "@/components/Shared";
import MoneyInput from "@/components/Shared/MoneyInput";
import { makePaymentFromForm } from "@/lib/debts/actions";
import type { DebtCardDebt } from "@/types/components/debts";

function PaymentAmountField(props: {
	name: string;
	required?: boolean;
	defaultAmount: number | null;
	isDisabled?: boolean;
}) {
	const { name, required, defaultAmount, isDisabled } = props;
	const [amountDraft, setAmountDraft] = useState(() => {
		if (defaultAmount == null) return "";
		return Number.isFinite(defaultAmount) ? defaultAmount.toFixed(2) : "";
	});

	return (
		<MoneyInput
			name={name}
			required={required}
			value={amountDraft}
			onChangeValue={setAmountDraft}
			placeholder="0.00"
			ariaLabel="Payment amount"
			size="sm"
			disabled={isDisabled}
			className="w-full rounded-lg border border-white/10 bg-slate-900/60"
			inputClassName="text-xs sm:text-sm"
		/>
	);
}

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
	isPaymentMonthPaid?: boolean;
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
		isPaymentMonthPaid,
	} = props;

	const amountSeed = defaultPaymentAmount ?? debt.amount;
	const effectiveDefaultAmount = isPaymentMonthPaid
		? null
		: (Number.isFinite(defaultPaymentAmount as number) ? (defaultPaymentAmount as number) : debt.amount);

	return (
		<div className="bg-slate-900/40 rounded-xl p-2.5 sm:p-4 border border-white/5">
			<h4 className="text-xs sm:text-sm font-semibold text-slate-300 mb-2 sm:mb-3">Record Payment</h4>
			<form
				key={amountSeed}
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
					<PaymentAmountField
						key={amountSeed}
						name="amount"
						required
						defaultAmount={effectiveDefaultAmount}
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
