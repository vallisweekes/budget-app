import Link from "next/link";

import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import { formatCurrency } from "@/lib/helpers/money";
import type { MonthKey } from "@/types";
import type { MonthlyAllocationSummaryRow } from "@/types/components/income";

export default function AllocationsSummaryTable({
	year,
	allocMonth,
	monthlyAllocationSummaries,
}: {
	year: number;
	allocMonth: MonthKey;
	monthlyAllocationSummaries: MonthlyAllocationSummaryRow[];
}) {
	return (
		<details className="bg-slate-800/30 rounded-3xl border border-white/10 overflow-hidden">
			<summary className="cursor-pointer select-none px-6 py-5 text-sm font-semibold text-white hover:bg-slate-800/40 transition">
				Monthly allocations summary
				<span className="ml-2 text-xs font-normal text-slate-400">Quick view; click a month to edit</span>
			</summary>
			<div className="px-6 pb-6">
				<div className="flex items-center justify-between gap-3">
					<div className="text-xs text-slate-400">Year {year}</div>
				</div>

				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full text-sm">
						<thead>
							<tr className="text-left text-slate-300">
								<th className="py-2 pr-4 font-medium">Month</th>
								<th className="py-2 pr-4 font-medium">Gross</th>
								<th className="py-2 pr-4 font-medium">Fixed</th>
								<th className="py-2 pr-4 font-medium">Custom</th>
								<th className="py-2 pr-4 font-medium">Total</th>
								<th className="py-2 pr-4 font-medium">Left</th>
								<th className="py-2 pr-4 font-medium">Action</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/10">
							{monthlyAllocationSummaries.map((row) => (
								<tr key={row.month} className={row.month === allocMonth ? "bg-emerald-500/5" : undefined}>
									<td className="py-3 pr-4 text-white">
										<div className="font-medium">{formatMonthKeyLabel(row.month)}</div>
										<div className="text-xs text-slate-400">{row.customCount} custom</div>
									</td>
									<td className="py-3 pr-4 text-slate-200">{formatCurrency(row.grossIncome)}</td>
									<td className="py-3 pr-4 text-slate-200">{formatCurrency(row.fixedTotal)}</td>
									<td className="py-3 pr-4 text-slate-200">{formatCurrency(row.customTotal)}</td>
									<td className="py-3 pr-4 text-white font-semibold">{formatCurrency(row.total)}</td>
									<td className={`py-3 pr-4 ${row.leftToBudget < 0 ? "text-red-200" : "text-emerald-200"}`}>
										{formatCurrency(row.leftToBudget)}
									</td>
									<td className="py-3 pr-4">
										<Link
											href={`?tab=allocations&month=${encodeURIComponent(row.month)}`}
											className="inline-flex items-center rounded-lg border border-white/10 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900/60 transition"
										>
											{row.month === allocMonth ? "Viewing" : "View / edit"}
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</details>
	);
}
