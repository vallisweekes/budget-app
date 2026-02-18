import Link from "next/link";

import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import { formatCurrency } from "@/lib/helpers/money";
import type { MonthKey } from "@/types";
import type { MonthlyAllocationSnapshot, MonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";

import {
	createCustomAllowanceAction,
	resetAllocationsToPlanDefaultAction,
	saveAllocationsAction,
} from "@/lib/income/actions";

import AllocationsMonthSaveRow from "@/components/Admin/Income/AllocationsMonthSaveRow";
import CreateAllowanceButton from "@/components/Admin/Income/CreateAllowanceButton";
import ResetAllocationsToDefaultButton from "@/components/Admin/Income/ResetAllocationsToDefaultButton";

import type { MonthlyAllocationSummaryRow } from "@/types/components/income";

export default function AllocationsEditorForm({
	budgetPlanId,
	allocMonth,
	allocation,
	customAllocations,
	hasOverridesForAllocMonth,
	monthlyAllocationSummaries,
}: {
	budgetPlanId: string;
	allocMonth: MonthKey;
	allocation: MonthlyAllocationSnapshot;
	customAllocations: MonthlyCustomAllocationsSnapshot;
	hasOverridesForAllocMonth: boolean;
	monthlyAllocationSummaries: MonthlyAllocationSummaryRow[];
}) {
	return (
		<>
			<form id="allocations-form" action={saveAllocationsAction} className="space-y-6">
				<input type="hidden" name="budgetPlanId" value={budgetPlanId} />

				<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-6 md:p-8">
					<div className="flex items-start justify-between gap-4">
						<div>
							<div className="text-sm font-semibold text-white">Edit income sacrifice for a month</div>
							<div className="text-xs text-slate-400">Adjust this month’s overrides, then save changes.</div>
						</div>
						<div className="text-xs text-slate-400">Switch months to view defaults/overrides.</div>
					</div>

					<div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4">
						<AllocationsMonthSaveRow
							formId="allocations-form"
							month={allocMonth}
							year={allocation.year}
							isOverride={allocation.isOverride}
							resetToDefault={
								hasOverridesForAllocMonth ? (
									<ResetAllocationsToDefaultButton
										budgetPlanId={budgetPlanId}
										month={allocMonth}
										action={resetAllocationsToPlanDefaultAction}
									/>
								) : null
							}
						/>
					</div>

					<div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="md:col-span-2">
							<div className="text-sm font-semibold text-white">Fixed income sacrifice</div>
							<div className="mt-1 text-xs text-slate-400">Default values come from the plan; changes are saved as overrides.</div>
						</div>
						<label>
							<span className="block text-sm font-medium text-slate-300 mb-2">Monthly Allowance (£)</span>
							<input
								name="monthlyAllowance"
								type="number"
								step="0.01"
								defaultValue={allocation.monthlyAllowance ?? 0}
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
							/>
						</label>
						<label>
							<span className="block text-sm font-medium text-slate-300 mb-2">Monthly Savings (£)</span>
							<input
								name="monthlySavingsContribution"
								type="number"
								step="0.01"
								defaultValue={allocation.monthlySavingsContribution ?? 0}
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
							/>
						</label>
						<label>
							<span className="block text-sm font-medium text-slate-300 mb-2">Emergency Fund (£)</span>
							<input
								name="monthlyEmergencyContribution"
								type="number"
								step="0.01"
								defaultValue={allocation.monthlyEmergencyContribution ?? 0}
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
							/>
						</label>
						<label>
							<span className="block text-sm font-medium text-slate-300 mb-2">Monthly Investments (£)</span>
							<input
								name="monthlyInvestmentContribution"
								type="number"
								step="0.01"
								defaultValue={allocation.monthlyInvestmentContribution ?? 0}
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
							/>
						</label>
					</div>

					<div className="mt-8">
						<div className="flex items-center justify-between gap-3">
							<div>
								<div className="text-sm font-semibold text-white">Custom items (this month)</div>
								<div className="mt-1 text-xs text-slate-400">Each item has a global default; edits here become month overrides.</div>
							</div>
							<div className="text-xs text-slate-400">Total: {formatCurrency(customAllocations.total ?? 0)}</div>
						</div>

						{customAllocations.items.length === 0 ? (
							<div className="mt-3 rounded-xl border border-dashed border-white/10 bg-slate-900/10 px-4 py-3 text-sm text-slate-300">
								No custom items yet. Use “Create allowance (global)” below.
							</div>
						) : (
							<div className="mt-4 grid grid-cols-1 gap-4">
								{customAllocations.items.map((item) => (
									<label key={item.id} className="block">
										<span className="block text-sm font-medium text-slate-300 mb-2">
											{item.name}
											{item.isOverride ? (
												<span className="ml-2 text-xs text-amber-200">(custom for this month)</span>
											) : null}
										</span>
										<input
											name={`customAllocation:${item.id}`}
											type="number"
											step="0.01"
											defaultValue={item.amount ?? 0}
											className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
										/>
									</label>
								))}
							</div>
						)}
					</div>
				</div>
			</form>

			<details className="bg-slate-800/30 rounded-3xl border border-white/10 overflow-hidden">
				<summary className="cursor-pointer select-none px-6 py-5 text-sm font-semibold text-white hover:bg-slate-800/40 transition">
					Create allowance (global)
					<span className="ml-2 text-xs font-normal text-slate-400">Adds an item that appears for every month</span>
				</summary>
				<div className="px-6 pb-6">
					<div className="text-xs text-slate-400">
						Examples: Tithe, Childcare, Pension. You can override amounts per month in the editor above.
					</div>

					<form action={createCustomAllowanceAction} className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4">
						<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
						<input type="hidden" name="month" value={allocMonth} />
						<label className="md:col-span-7">
							<span className="block text-sm font-medium text-slate-300 mb-2">Allowance name</span>
							<input
								name="name"
								placeholder="e.g., Tithe"
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
							/>
						</label>
						<label className="md:col-span-3">
							<span className="block text-sm font-medium text-slate-300 mb-2">Default amount (£)</span>
							<input
								name="defaultAmount"
								type="number"
								step="0.01"
								placeholder="0.00"
								className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
							/>
						</label>
						<div className="md:col-span-2 flex items-end">
							<CreateAllowanceButton />
						</div>
					</form>
				</div>
			</details>

			<details className="bg-slate-800/30 rounded-3xl border border-white/10 overflow-hidden">
				<summary className="cursor-pointer select-none px-6 py-5 text-sm font-semibold text-white hover:bg-slate-800/40 transition">
					Monthly allocations summary
					<span className="ml-2 text-xs font-normal text-slate-400">Quick view; click a month to edit</span>
				</summary>
				<div className="px-6 pb-6">
					<div className="flex items-center justify-between gap-3">
						<div className="text-xs text-slate-400">Year {allocation.year}</div>
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
		</>
	);
}
