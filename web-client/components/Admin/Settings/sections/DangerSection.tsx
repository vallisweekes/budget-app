"use client";

import DeleteBudgetPlanButton from "@/components/Admin/Settings/DeleteBudgetPlanButton";

export default function DangerSection({
	budgetPlanId,
	allPlans,
}: {
	budgetPlanId: string;
	allPlans: Array<{ id: string; name: string; kind: string }>;
}) {
	return (
		<section className="space-y-6">
			<div className="flex items-center justify-between gap-4 mb-5">
				<div>
					<h2 className="text-2xl font-bold text-white">Danger Zone</h2>
					<p className="text-slate-400 text-sm">Actions here are permanent.</p>
				</div>
			</div>

			<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-red-500/20 p-8 hover:border-red-500/30 transition-all">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div>
						<h3 className="text-xl font-bold text-white">Delete this budget plan</h3>
						<p className="text-slate-400 text-sm mt-1">This permanently deletes the plan and all associated data.</p>
					</div>
					<DeleteBudgetPlanButton
						budgetPlanId={budgetPlanId}
						planName={allPlans.find((p) => p.id === budgetPlanId)?.name}
						planKind={allPlans.find((p) => p.id === budgetPlanId)?.kind}
					/>
				</div>
			</div>
		</section>
	);
}
