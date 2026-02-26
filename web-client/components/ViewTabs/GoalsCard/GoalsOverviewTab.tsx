import type { GoalLike } from "@/types";

import Currency from "@/components/ViewTabs/Currency";

export default function GoalsOverviewTab({ goals }: { goals: GoalLike[] }) {
	if (goals.length === 0) {
		return <div className="text-sm text-slate-300">Add a target amount to a goal to show it here.</div>;
	}

	return (
		<div className={`grid grid-cols-1 ${goals.length === 1 ? "md:grid-cols-1" : "md:grid-cols-2"} gap-3`}>
			{goals.map((g) => {
				const target = g.targetAmount ?? 0;
				const current = g.currentAmount ?? 0;
				const progress = target > 0 ? Math.min(1, current / target) : 0;
				return (
					<div key={g.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
						<div className="font-semibold text-white truncate">{g.title}</div>
						{target > 0 ? (
							<>
								<div className="mt-2 flex items-center justify-between text-sm text-slate-200">
									<span>
										<Currency value={current} />
									</span>
									<span>
										<Currency value={target} />
									</span>
								</div>
								<div className="mt-2 h-2 sm:h-4 rounded-full bg-white/10 overflow-hidden">
									<div
										className="h-2 sm:h-4 rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
										style={{ width: `${progress * 100}%` }}
									/>
								</div>
							</>
						) : (
							<div className="mt-2 text-sm text-slate-300">No target amount set</div>
						)}
						{g.targetYear ? <div className="mt-2 text-xs text-slate-400">Target year: {g.targetYear}</div> : null}
					</div>
				);
			})}
		</div>
	);
}
