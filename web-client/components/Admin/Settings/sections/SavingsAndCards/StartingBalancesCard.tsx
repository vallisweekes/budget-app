"use client";

import { Wallet, Edit2 } from "lucide-react";
import { InfoTooltip } from "@/components/Shared";
import type { Settings } from "@/lib/settings/store";

export default function StartingBalancesCard(props: {
	hasPlan: boolean;
	budgetPlanId?: string | null;
	settings: Settings;
	isEditing: boolean;
	setIsEditing: (next: boolean) => void;
	isSaving: boolean;
	saveAction: (formData: FormData) => void;
}) {
	const { hasPlan, budgetPlanId, settings, isEditing, setIsEditing, isSaving, saveAction } = props;

	return (
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
								onClick={() => {
									if (!hasPlan) return;
									setIsEditing(true);
								}}
								disabled={!hasPlan}
								className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20 transition"
							>
								<Edit2 className="h-4 w-4" />
								Edit
							</button>
						) : null}
					</div>
				</div>
			</div>

			{!isEditing || !hasPlan ? (
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
					<div className="text-xs text-slate-500">{hasPlan ? "Click Edit to update these balances." : "Create a plan to edit these balances."}</div>
				</div>
			) : (
				<form action={saveAction} className="space-y-4">
					<input type="hidden" name="budgetPlanId" value={String(budgetPlanId)} />
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
	);
}
