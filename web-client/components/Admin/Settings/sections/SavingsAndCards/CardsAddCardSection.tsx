"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createDebt } from "@/lib/debts/actions";

export default function CardsAddCardSection({
	hasPlan,
	budgetPlanId,
}: {
	hasPlan: boolean;
	budgetPlanId?: string | null;
}) {
	const router = useRouter();
	const [showAddCard, setShowAddCard] = useState(false);
	const [addCardError, setAddCardError] = useState<string | null>(null);
	const [isAddingCard, startAddCardTransition] = useTransition();

	if (!hasPlan) return null;

	return (
		<div className="pt-2">
			{!showAddCard ? (
				<button
					type="button"
					onClick={() => {
						setAddCardError(null);
						setShowAddCard(true);
					}}
					className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20 transition"
				>
					Add card
				</button>
			) : (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						setAddCardError(null);
						const form = e.currentTarget;
						const data = new FormData(form);
						startAddCardTransition(async () => {
							try {
								await createDebt(data);
								setShowAddCard(false);
								form.reset();
								router.refresh();
							} catch (err) {
								setAddCardError(err instanceof Error ? err.message : "Could not add card.");
							}
						});
					}}
					className="mt-3 rounded-2xl bg-slate-950/30 ring-1 ring-white/10 p-4 space-y-3"
				>
					<input type="hidden" name="budgetPlanId" value={String(budgetPlanId)} />
					<input type="hidden" name="defaultPaymentSource" value="income" />

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label className="block">
							<span className="text-sm font-medium text-slate-400 mb-2 block">Card name</span>
							<input
								name="name"
								required
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-base font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
								placeholder="e.g. Amex"
							/>
						</label>
						<label className="block">
							<span className="text-sm font-medium text-slate-400 mb-2 block">Type</span>
							<select
								name="type"
								required
								defaultValue="credit_card"
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-base font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
							>
								<option value="credit_card">Credit card</option>
								<option value="store_card">Store card</option>
							</select>
						</label>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<label className="block">
							<span className="text-sm font-medium text-slate-400 mb-2 block">Credit limit</span>
							<input
								name="creditLimit"
								type="number"
								step="0.01"
								min={0}
								required
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-base font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
								placeholder="0"
							/>
						</label>
						<label className="block">
							<span className="text-sm font-medium text-slate-400 mb-2 block">Initial balance</span>
							<input
								name="initialBalance"
								type="number"
								step="0.01"
								min={0}
								required
								defaultValue={0}
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-base font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
								placeholder="0"
							/>
							<div className="mt-1 text-[11px] text-slate-500">
								Current balance starts the same; you can edit it after adding.
							</div>
						</label>
						<label className="block">
							<span className="text-sm font-medium text-slate-400 mb-2 block">Due date (optional)</span>
							<input
								name="dueDate"
								type="date"
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-base font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
							/>
						</label>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								if (isAddingCard) return;
								setShowAddCard(false);
								setAddCardError(null);
							}}
							className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition disabled:opacity-60"
							disabled={isAddingCard}
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isAddingCard}
							className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-60"
						>
							{isAddingCard ? "Adding…" : "Add card"}
						</button>
					</div>

					{addCardError ? <p className="text-xs text-red-200">{addCardError}</p> : null}
				</form>
			)}
		</div>
	);
}
