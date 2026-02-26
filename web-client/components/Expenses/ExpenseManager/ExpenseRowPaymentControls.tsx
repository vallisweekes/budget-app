"use client";

import { SelectDropdown } from "@/components/Shared";
import type { CreditCardOption, DebtOption } from "@/types/expenses-manager";

export default function ExpenseRowPaymentControls({
	paymentValue,
	onPaymentValueChange,
	paymentSourceValue,
	onPaymentSourceChange,
	debtOptions,
	debtIdValue,
	onDebtIdChange,
	cards,
	cardDebtIdValue,
	onCardDebtIdChange,
	onApplyPayment,
	isBusy,
}: {
	paymentValue: string;
	onPaymentValueChange: (value: string) => void;
	paymentSourceValue: string;
	onPaymentSourceChange: (value: string) => void;
	debtOptions: DebtOption[];
	debtIdValue?: string;
	onDebtIdChange?: (value: string) => void;
	cards: CreditCardOption[];
	cardDebtIdValue?: string;
	onCardDebtIdChange?: (value: string) => void;
	onApplyPayment: () => void;
	isBusy?: boolean;
}) {
	const isCreditCard = paymentSourceValue === "credit_card";
	const cardRequired = isCreditCard && cards.length > 1;
	const hasSelectedCard = Boolean((cardDebtIdValue ?? "").trim());
	const showDebtDropdown = !isCreditCard && debtOptions.length > 0;
	const hasSecondDropdownColumn = showDebtDropdown || isCreditCard;

	const disableApplyPayment =
		Boolean(isBusy) || (isCreditCard && (cards.length === 0 || (cardRequired && !hasSelectedCard)));

	return (
		<div className="w-full">
			<label className="block">
				<span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1">Payment amount (£)</span>
				<div className="grid grid-cols-2 sm:grid-cols-12 gap-1.5 sm:gap-2 items-stretch">
					<input
						type="number"
						step="0.01"
						min={0}
						value={paymentValue}
						onChange={(e) => onPaymentValueChange(e.target.value)}
						className="w-full col-span-2 sm:col-span-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-white/10 bg-slate-900/40 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all"
						placeholder="0.00"
					/>

					<SelectDropdown
						value={paymentSourceValue}
						onValueChange={onPaymentSourceChange}
						options={[
							{ value: "income", label: "Income" },
							{ value: "credit_card", label: "Credit Card" },
							{ value: "savings", label: "Savings" },
							{ value: "other", label: "Other" },
						]}
						buttonClassName="focus:ring-purple-500/50"
						className={`w-full min-w-0 ${hasSecondDropdownColumn ? "col-span-1" : "col-span-2"} sm:col-span-3 sm:min-w-[140px]`}
					/>

					{showDebtDropdown ? (
						<SelectDropdown
							value={debtIdValue ?? ""}
							onValueChange={(v) => onDebtIdChange?.(v)}
							placeholder="Applies to debt (optional)"
							options={[
								{ value: "", label: "No debt" },
								...debtOptions.map((d) => ({ value: d.id, label: d.name })),
							]}
							buttonClassName="focus:ring-purple-500/50"
							className="w-full min-w-0 col-span-1 sm:col-span-4 sm:min-w-[200px]"
						/>
					) : null}

					{isCreditCard ? (
						cards.length > 0 ? (
							<SelectDropdown
								value={cardDebtIdValue ?? ""}
								onValueChange={(v) => onCardDebtIdChange?.(v)}
								required={cardRequired}
								placeholder={cards.length === 1 ? "Card" : "Choose card"}
								options={cards.map((c) => ({ value: c.id, label: c.name }))}
								buttonClassName="focus:ring-purple-500/50"
								className="w-full min-w-0 col-span-1 sm:col-span-4 sm:min-w-[160px]"
							/>
						) : (
							<div className="w-full min-w-0 col-span-1 sm:col-span-4 sm:min-w-[160px] rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[10px] sm:text-xs text-amber-100">
								No cards
							</div>
						)
					) : null}

					<button
						type="button"
						onClick={onApplyPayment}
						disabled={disableApplyPayment}
						className="w-full col-span-2 sm:w-auto sm:col-span-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-purple-500/20 text-purple-200 border border-purple-400/30 hover:bg-purple-500/30 transition-all cursor-pointer disabled:opacity-50 text-[10px] sm:text-xs whitespace-nowrap"
					>
						Add payment
					</button>
				</div>
			</label>

			{isCreditCard && cards.length === 0 ? (
				<p className="mt-1 text-[10px] sm:text-xs text-amber-200/90">Add a card in Debts to use this source.</p>
			) : isCreditCard && cardRequired && !hasSelectedCard ? (
				<p className="mt-1 text-[10px] sm:text-xs text-amber-200/90">Select a card to continue.</p>
			) : null}
		</div>
	);
}
