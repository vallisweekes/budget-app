"use client";

import { useMemo, useState } from "react";
import { SelectDropdown } from "@/components/Shared";
import type { CreditCardOption, ExpenseCategoryOption } from "@/types/expenses-manager";

type Props = {
	categories: ExpenseCategoryOption[];
	planKind?: string;
	creditCards?: CreditCardOption[];
};

export default function AddExpenseDetailsFields({ categories, planKind, creditCards }: Props) {
	const cards = creditCards ?? [];
	const [paymentSource, setPaymentSource] = useState<string>("income");
	const [cardDebtId, setCardDebtId] = useState<string>("");
	const [isAllocation, setIsAllocation] = useState(false);
	const [isDirectDebit, setIsDirectDebit] = useState(false);

	const isCreditCard = paymentSource === "credit_card";
	const shouldRequireCard = isCreditCard && cards.length > 1;
	const effectiveCardDebtId = useMemo(() => {
		if (!isCreditCard) return "";
		if (cardDebtId) return cardDebtId;
		if (cards.length === 1) return cards[0]!.id;
		return "";
	}, [cardDebtId, cards, isCreditCard]);

	const creditCardOptions = useMemo(() => {
		return cards.map((c) => ({ value: c.id, label: c.name }));
	}, [cards]);

	return (
		<>
			<div className="space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Expense Name</span>
					<input
						name="name"
						required
						className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
						placeholder="e.g., Monthly Rent"
					/>
					</label>

					<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Amount (£)</span>
					<input
						name="amount"
						type="number"
						step="0.01"
						required
						className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all"
						placeholder="0.00"
					/>
					</label>
				</div>

				<div className="grid grid-cols-2 gap-6">
					<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Category</span>
					<SelectDropdown
						name="categoryId"
						placeholder="Select Category"
						options={[
							...categories.map((c) => ({ value: c.id, label: c.name })),
							{ value: "", label: "Miscellaneous" },
						]}
						buttonClassName="focus:ring-purple-500/50"
					/>
					</label>

					<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Payment Status</span>
					<SelectDropdown
						name="paid"
						defaultValue="false"
						options={[
							{ value: "false", label: "Not Paid" },
							{ value: "true", label: "Paid" },
						]}
						buttonClassName="focus:ring-purple-500/50"
					/>
					</label>
				</div>

				<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">
						Due Date <span className="text-slate-500 font-normal">(optional)</span>
					</span>
					<input
						name="dueDate"
						type="date"
						className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all [color-scheme:dark]"
					/>
				</label>

				<label className="block">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Source of Funds</span>
					<SelectDropdown
						name="paymentSource"
						value={paymentSource}
						onValueChange={(v) => setPaymentSource(v)}
						options={[
							{ value: "income", label: "Income" },
							{ value: "credit_card", label: "Credit Card" },
							{ value: "savings", label: "Savings" },
							{ value: "other", label: "Other" },
						]}
						buttonClassName="focus:ring-purple-500/50"
					/>
				</label>

				{isCreditCard ? (
					cards.length > 0 ? (
						<label className="block">
							<span className="text-sm font-medium text-slate-300 mb-2 block">Which card?</span>
							<SelectDropdown
								name="cardDebtId"
								value={effectiveCardDebtId}
								onValueChange={(v) => setCardDebtId(v)}
								required={shouldRequireCard}
								placeholder={cards.length === 1 ? "Using your only card" : "Select a card"}
								options={creditCardOptions}
								buttonClassName="focus:ring-purple-500/50"
							/>
							{cards.length === 1 ? (
								<p className="mt-1 text-xs text-slate-400">This expense will be charged to {cards[0]!.name}.</p>
							) : null}
						</label>
					) : (
						<div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
							<div className="text-sm font-semibold text-amber-100">No credit cards found for this plan</div>
							<div className="mt-1 text-xs text-amber-200/80">Add a credit card in Debts, or choose a different payment source.</div>
						</div>
					)
				) : null}
			</div>

			<label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/30 p-4 cursor-pointer select-none" onClick={() => setIsAllocation((v) => !v)}>
				<input type="hidden" name="isAllocation" value={isAllocation ? "true" : "false"} />
				<div className="min-w-0 flex-1">
					<div className="text-sm font-semibold text-white">Treat this as an allocation</div>
					<div className="mt-1 text-xs text-slate-300">Use this for envelopes like groceries/transport so they never appear as debts.</div>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={isAllocation}
					onClick={(e) => { e.stopPropagation(); setIsAllocation((v) => !v); }}
					className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
						isAllocation ? "bg-purple-600 border-purple-500" : "bg-slate-800 border-white/10"
					}`}
				>
					<span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${isAllocation ? "translate-x-[22px]" : "translate-x-1"}`} />
				</button>
			</label>

			<label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/30 p-4 cursor-pointer select-none" onClick={() => setIsDirectDebit((v) => !v)}>
				<input type="hidden" name="isDirectDebit" value={isDirectDebit ? "true" : "false"} />
				<div className="min-w-0 flex-1">
					<div className="text-sm font-semibold text-white">Direct Debit / Standing Order</div>
					<div className="mt-1 text-xs text-slate-300">Automatically collected — safe to distribute across months without creating a debt.</div>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={isDirectDebit}
					onClick={(e) => { e.stopPropagation(); setIsDirectDebit((v) => !v); }}
					className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
						isDirectDebit ? "bg-purple-600 border-purple-500" : "bg-slate-800 border-white/10"
					}`}
				>
					<span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${isDirectDebit ? "translate-x-[22px]" : "translate-x-1"}`} />
				</button>
			</label>
		</>
	);
}
