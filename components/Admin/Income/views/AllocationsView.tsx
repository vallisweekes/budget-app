import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";
import type { MonthlyAllocationSnapshot, MonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";

import SaveFeedbackBanner from "@/components/Admin/Income/SaveFeedbackBanner";
import AllocationsEditorForm from "@/components/Admin/Income/views/AllocationsEditorForm";
import AllocationsSummaryCards from "@/components/Admin/Income/views/AllocationsSummaryCards";
import type { MonthlyAllocationSummaryRow } from "@/types/components/income";

export default function AllocationsView({
	budgetPlanId,
	allocMonth,
	allocation,
	customAllocations,
	hasOverridesForAllocMonth,
	monthlyAllocationSummaries,
	grossIncomeForAllocMonth,
	totalAllocationsForAllocMonth,
	remainingToBudgetForAllocMonth,
}: {
	budgetPlanId: string;
	allocMonth: MonthKey;
	allocation: MonthlyAllocationSnapshot;
	customAllocations: MonthlyCustomAllocationsSnapshot;
	hasOverridesForAllocMonth: boolean;
	monthlyAllocationSummaries: MonthlyAllocationSummaryRow[];
	grossIncomeForAllocMonth: number;
	totalAllocationsForAllocMonth: number;
	remainingToBudgetForAllocMonth: number;
}) {
	return (
		<div className="space-y-8">
			<AllocationsSummaryCards
				monthLabel={formatMonthKeyLabel(allocMonth)}
				grossIncome={grossIncomeForAllocMonth}
				totalAllocations={totalAllocationsForAllocMonth}
				remainingToBudget={remainingToBudgetForAllocMonth}
			/>

			<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-6 md:p-8">
				<div className="flex items-center justify-between gap-4">
					<div>
						<h2 className="text-2xl font-bold text-white">Income sacrifice</h2>
						<p className="mt-1 text-slate-400 text-sm">Edit month-specific overrides. Create new items globally.</p>
					</div>
					<div className="hidden md:block text-xs text-slate-400">Month: {formatMonthKeyLabel(allocMonth)}</div>
				</div>
				<div className="mt-5 space-y-3">
					<SaveFeedbackBanner
						kind="allocations"
						message="Saved changes apply to the selected month only (month-specific overrides)."
					/>
					<SaveFeedbackBanner kind="allocationsReset" message="This month has been reset back to your plan defaults." />
					<SaveFeedbackBanner kind="allowanceCreated" message="New allowance created. It now shows for all months." />
				</div>
			</div>

			<AllocationsEditorForm
				budgetPlanId={budgetPlanId}
				allocMonth={allocMonth}
				allocation={allocation}
				customAllocations={customAllocations}
				hasOverridesForAllocMonth={hasOverridesForAllocMonth}
				monthlyAllocationSummaries={monthlyAllocationSummaries}
			/>
		</div>
	);
}
