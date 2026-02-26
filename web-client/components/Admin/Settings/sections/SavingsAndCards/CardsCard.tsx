"use client";

import { Wallet } from "lucide-react";
import { useFormStatus } from "react-dom";

import { InfoTooltip } from "@/components/Shared";
import type { DebtCardDebt } from "@/types/components/debts";
import { updateCardSettingsAction } from "@/lib/debts/actions";
import CardsAddCardSection from "@/components/Admin/Settings/sections/SavingsAndCards/CardsAddCardSection";

function CardSaveButton() {
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
			className="rounded-xl bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-60"
		>
			{pending ? "Saving…" : "Save"}
		</button>
	);
}

export default function CardsCard(props: { budgetPlanId?: string | null; hasPlan: boolean; cardDebts: DebtCardDebt[] }) {
	const { budgetPlanId, hasPlan, cardDebts } = props;

	return (
		<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
			<div className="flex items-center gap-3 mb-6">
				<div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
					<Wallet className="w-5 h-5 text-slate-200" />
				</div>
				<div className="flex-1">
					<h3 className="text-xl font-bold text-white inline-flex items-center gap-2">
						Cards
						<InfoTooltip
							ariaLabel="Cards info"
							content="Edit your card limits and balances here. These values update the matching Debts automatically, so everything stays in sync across the app."
						/>
					</h3>
					<p className="text-slate-400 text-sm">Credit cards and store cards.</p>
				</div>
			</div>

			{!hasPlan ? (
				<div className="text-sm text-slate-400">Create a plan to add and manage cards.</div>
			) : cardDebts.length === 0 ? (
				<div className="text-sm text-slate-400">No cards yet. Add one here to start tracking it.</div>
			) : (
				<div className="space-y-4">
					{cardDebts.map((card) => (
						<form
							key={card.id}
							action={updateCardSettingsAction.bind(null, card.id)}
							className="rounded-2xl bg-slate-950/30 ring-1 ring-white/10 p-4"
						>
							<input type="hidden" name="budgetPlanId" value={String(budgetPlanId)} />
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-sm font-semibold text-white">{card.name}</div>
									<div className="text-xs text-slate-400">{card.type === "store_card" ? "Store card" : "Credit card"}</div>
								</div>
								<CardSaveButton />
							</div>

							<div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
								<label className="block">
									<span className="text-sm font-medium text-slate-400 mb-2 block">Credit limit</span>
									<input
										name="creditLimit"
										type="number"
										step="0.01"
										min={0}
										required
										defaultValue={Number.isFinite(card.creditLimit as number) ? Number(card.creditLimit) : 0}
										className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
										defaultValue={Number.isFinite(card.initialBalance) ? card.initialBalance : 0}
										className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
									/>
								</label>
								<label className="block">
									<span className="text-sm font-medium text-slate-400 mb-2 block">Current balance</span>
									<input
										name="currentBalance"
										type="number"
										step="0.01"
										min={0}
										required
										defaultValue={Number.isFinite(card.currentBalance) ? card.currentBalance : 0}
										className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
									/>
								</label>
							</div>
							<div className="mt-2 text-xs text-slate-500">Saving updates the matching debt automatically.</div>
						</form>
					))}
				</div>
			)}

			<CardsAddCardSection hasPlan={hasPlan} budgetPlanId={budgetPlanId} />
		</div>
	);
}
