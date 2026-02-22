import { formatCurrency } from "@/lib/helpers/money";

export default function AllocationsSummaryCards({
	monthLabel,
	grossIncome,
	totalAllocations,
	remainingToBudget,
}: {
	monthLabel: string;
	grossIncome: number;
	totalAllocations: number;
	remainingToBudget: number;
}) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div className="rounded-2xl border border-white/10 bg-slate-900/30 px-5 py-4">
				<div className="text-xs text-slate-400">Gross income ({monthLabel})</div>
				<div className="mt-1 text-xl font-bold text-white">{formatCurrency(grossIncome)}</div>
			</div>
			<div className="rounded-2xl border border-white/10 bg-slate-900/30 px-5 py-4">
				<div className="text-xs text-slate-400">Total income sacrifice</div>
				<div className="mt-1 text-xl font-bold text-white">{formatCurrency(totalAllocations)}</div>
				<div className="mt-1 text-xs text-slate-400">Fixed + custom items</div>
			</div>
			<div className="rounded-2xl border border-white/10 bg-slate-900/30 px-5 py-4">
				<div className="text-xs text-slate-400">Left to budget</div>
				<div className={`mt-1 text-xl font-bold ${remainingToBudget < 0 ? "text-red-200" : "text-emerald-200"}`}>
					{formatCurrency(remainingToBudget)}
				</div>
				{remainingToBudget < 0 ? (
					<div className="mt-1 text-xs text-red-200">
						Income sacrifice exceeds income by {formatCurrency(Math.abs(remainingToBudget))}
					</div>
				) : null}
			</div>
		</div>
	);
}
