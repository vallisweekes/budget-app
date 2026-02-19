"use client";

import { useRouter } from "next/navigation";
import { Edit2, Wallet } from "lucide-react";
import { InfoTooltip } from "@/components/Shared";
import { saveSettingsAction } from "@/lib/settings/actions";
import { useStartingBalancesEditor } from "@/components/Admin/Settings/hooks/useStartingBalancesEditor";
import type { Settings } from "@/lib/settings/store";
import type { DebtCardDebt } from "@/types/components/debts";
import { updateCardSettingsAction } from "@/lib/debts/actions";
import { useFormStatus } from "react-dom";

function CardSaveButton() {
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
			className="rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-60"
		>
			{pending ? "Saving…" : "Save"}
		</button>
	);
}

export default function SavingsSection({
	budgetPlanId,
	settings,
	cardDebts,
}: {
	budgetPlanId: string;
	settings: Settings;
	cardDebts: DebtCardDebt[];
}) {
	const router = useRouter();
	const { isEditing, setIsEditing, isSaving, saveAction } = useStartingBalancesEditor({
		router,
		onSave: saveSettingsAction,
	});

	return (
		<section className="space-y-6">
			<div className="flex items-center justify-between gap-4 mb-5">
				<div>
					<h2 className="text-2xl font-bold text-white">Savings and Cards</h2>
					<p className="text-slate-400 text-sm">Starting balances used across the app.</p>
				</div>
				<span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
					Balances
				</span>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
					<div className="flex items-center gap-3 mb-6">
						<div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
							<Wallet className="w-5 h-5 text-slate-200" />
						</div>
						<div className="flex-1">
							<div className="flex items-start justify-between gap-3">
								<div>
									<h3 className="text-xl font-bold text-white inline-flex items-center gap-2">
										Starting balances
										<InfoTooltip
											ariaLabel="Starting balances info"
											content="Set your current Savings, Emergency, and Investment balances so the app can calculate goal progress and show balance-aware insights."
										/>
									</h3>
									<p className="text-slate-400 text-sm">Used for goals and balance-aware planning.</p>
								</div>
								{!isEditing ? (
									<button
										type="button"
										onClick={() => setIsEditing(true)}
										className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20 transition"
									>
										<Edit2 className="h-4 w-4" />
										Edit
									</button>
								) : null}
							</div>
						</div>
					</div>

					{!isEditing ? (
						<div className="space-y-4">
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<label className="block">
									<span className="text-sm font-medium text-slate-400 mb-2 block">Savings balance</span>
									<input
										disabled
										value={Number(settings.savingsBalance ?? 0)}
										type="number"
										step="0.01"
										className="w-full rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-white/90 text-lg font-semibold placeholder-slate-500"
									/>
								</label>
								<label className="block">
									<span className="text-sm font-medium text-slate-400 mb-2 block">Emergency balance</span>
									<input
										disabled
										value={Number(settings.emergencyBalance ?? 0)}
										type="number"
										step="0.01"
										className="w-full rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-white/90 text-lg font-semibold placeholder-slate-500"
									/>
								</label>
								<label className="block">
									<span className="text-sm font-medium text-slate-400 mb-2 block">Investment balance</span>
									<input
										disabled
										value={Number(settings.investmentBalance ?? 0)}
										type="number"
										step="0.01"
										className="w-full rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-white/90 text-lg font-semibold placeholder-slate-500"
									/>
								</label>
							</div>
							<div className="text-xs text-slate-500">Click Edit to update these balances.</div>
						</div>
					) : (
						<form action={saveAction} className="space-y-4">
							<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<label className="block">
									<span className="text-sm font-medium text-slate-400 mb-2 block">Savings balance</span>
									<input
										autoFocus
										name="savingsBalance"
										type="number"
										step="0.01"
										defaultValue={Number(settings.savingsBalance ?? 0)}
										className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
									/>
								</label>
								<label className="block">
									<span className="text-sm font-medium text-slate-400 mb-2 block">Emergency balance</span>
									<input
										name="emergencyBalance"
										type="number"
										step="0.01"
										defaultValue={Number(settings.emergencyBalance ?? 0)}
										className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
									/>
								</label>
								<label className="block">
									<span className="text-sm font-medium text-slate-400 mb-2 block">Investment balance</span>
									<input
										name="investmentBalance"
										type="number"
										step="0.01"
										defaultValue={Number(settings.investmentBalance ?? 0)}
										className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
									/>
								</label>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => {
										if (isSaving) return;
										setIsEditing(false);
									}}
									className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isSaving}
									className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
								>
									{isSaving ? "Saving…" : "Save"}
								</button>
							</div>
						</form>
					)}
				</div>

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

					{cardDebts.length === 0 ? (
						<div className="text-sm text-slate-400">
							No cards yet. Add a Credit Card or Store Card in the Debts section.
						</div>
					) : (
						<div className="space-y-4">
							{cardDebts.map((card) => (
								<form
									key={card.id}
									action={updateCardSettingsAction.bind(null, card.id)}
									className="rounded-2xl bg-slate-950/30 ring-1 ring-white/10 p-4"
								>
									<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="text-sm font-semibold text-white">{card.name}</div>
											<div className="text-xs text-slate-400">
												{card.type === "store_card" ? "Store card" : "Credit card"}
											</div>
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
									<div className="mt-2 text-xs text-slate-500">
										Saving updates the matching debt automatically.
									</div>
								</form>
							))}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
