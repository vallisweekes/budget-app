"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import MonthPreviewForm from "@/components/Admin/Settings/sections/budget/MonthPreviewForm";
import { applyFiftyThirtyTwentyTargetsAction } from "@/lib/settings/actions";
import type { FiftyThirtyTwentySummary as FiftyThirtyTwentySummaryType, MonthSummary } from "@/types/components";
import type { MonthKey } from "@/types";

export default function FiftyThirtyTwentySummary({
	budgetPlanId,
	monthSummary,
	fiftyThirtyTwenty,
	selectedMonth,
}: {
	budgetPlanId: string;
	monthSummary: MonthSummary;
	fiftyThirtyTwenty: FiftyThirtyTwentySummaryType;
	selectedMonth: MonthKey;
}) {
	const searchParams = useSearchParams();
	const applied = searchParams?.get("applied") ?? "";
	const [showApply, setShowApply] = useState(false);

	const previewYear = useMemo(() => monthSummary.year, [monthSummary.year]);

	return (
		<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
			<div className="flex items-start justify-between gap-4 mb-6">
				<div>
					<h3 className="text-xl font-bold text-white">50/30/20 targets</h3>
					<p className="text-slate-400 text-sm">Simple guideline based on your income for the month.</p>
				</div>
				<MonthPreviewForm selectedMonth={selectedMonth} />
			</div>

			<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 mb-5">
				<p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Income used for targets</p>
				<p className="text-2xl font-extrabold text-white mt-1">£{monthSummary.incomeTotal.toFixed(2)}</p>
				<p className="text-xs text-slate-500 mt-2">
					Previewing: {selectedMonth} {previewYear}
				</p>
				<p className="text-xs text-slate-500 mt-2">Needs and wants are approximations until category tagging is added.</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
					<p className="text-slate-300 font-semibold">Needs (50%)</p>
					<p className="text-white font-bold mt-1">Target: £{fiftyThirtyTwenty.needsTarget.toFixed(2)}</p>
					<p className="text-slate-400 text-sm mt-1">Actual (expenses): £{fiftyThirtyTwenty.needsActual.toFixed(2)}</p>
					<p className="text-slate-500 text-xs mt-1">
						Delta: £{(fiftyThirtyTwenty.needsActual - fiftyThirtyTwenty.needsTarget).toFixed(2)}
					</p>
				</div>
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
					<p className="text-slate-300 font-semibold">Wants (30%)</p>
					<p className="text-white font-bold mt-1">Target: £{fiftyThirtyTwenty.wantsTarget.toFixed(2)}</p>
					<p className="text-slate-400 text-sm mt-1">Actual (allowance): £{fiftyThirtyTwenty.wantsActual.toFixed(2)}</p>
					<p className="text-slate-500 text-xs mt-1">
						Delta: £{(fiftyThirtyTwenty.wantsActual - fiftyThirtyTwenty.wantsTarget).toFixed(2)}
					</p>
				</div>
				<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
					<p className="text-slate-300 font-semibold">Savings/Debt (20%)</p>
					<p className="text-white font-bold mt-1">Target: £{fiftyThirtyTwenty.savingsDebtTarget.toFixed(2)}</p>
					<p className="text-slate-400 text-sm mt-1">
						Actual (savings + investments + debt): £{fiftyThirtyTwenty.savingsDebtActual.toFixed(2)}
					</p>
					<p className="text-slate-500 text-xs mt-1">
						Delta: £{(fiftyThirtyTwenty.savingsDebtActual - fiftyThirtyTwenty.savingsDebtTarget).toFixed(2)}
					</p>
				</div>
			</div>

			{applied === "503020" ? (
				<div className="mt-5 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-4">
					<div className="text-sm font-semibold text-emerald-200">
						Applied 50/30/20 targets for {selectedMonth} {previewYear}.
					</div>
					<div className="text-xs text-emerald-200/80 mt-1">Allowance and Savings were updated for this month.</div>
				</div>
			) : null}

			<div className="mt-5 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
				<div className="text-sm font-semibold text-white">Apply these targets to your budget</div>
				<div className="text-xs text-slate-400 mt-1">
					Writes a monthly override for {selectedMonth} {previewYear}. Uses your debt plan amounts (from Debts) when calculating the 20% bucket.
				</div>

				{!showApply ? (
					<button
						type="button"
						onClick={() => setShowApply(true)}
						className="mt-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
					>
						Preview + Apply
					</button>
				) : (
					<div className="mt-3 flex items-center gap-2">
						<button
							type="button"
							onClick={() => setShowApply(false)}
							className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
						>
							Cancel
						</button>
						<form action={applyFiftyThirtyTwentyTargetsAction}>
							<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
							<input type="hidden" name="month" value={selectedMonth} />
							<input type="hidden" name="year" value={previewYear} />
							<button
								type="submit"
								className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
							>
								Apply now
							</button>
						</form>
					</div>
				)}
			</div>

			{showApply ? (
				<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
					<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
						<p className="text-slate-400">Allowance (30% target)</p>
						<p className="text-white font-bold">£{fiftyThirtyTwenty.wantsTarget.toFixed(2)}</p>
						<p className="text-xs text-slate-500 mt-1">
							This will set your monthly allowance override to match the 30% guideline.
						</p>
					</div>
					<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
						<p className="text-slate-400">Savings/Debt (20% target)</p>
						<p className="text-white font-bold">£{fiftyThirtyTwenty.savingsDebtTarget.toFixed(2)}</p>
						<p className="text-xs text-slate-500 mt-1">
							This will adjust your Savings contribution for the month (keeping Emergency + Investments as-is) so that Savings + Emergency + Investments + planned debt ≈ 20% of income.
						</p>
					</div>
				</div>
			) : null}
		</div>
	);
}
