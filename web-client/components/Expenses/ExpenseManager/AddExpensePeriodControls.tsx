"use client";

import type { MonthKey } from "@/types";
import { SelectDropdown } from "@/components/Shared";
import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import { MONTHS } from "@/lib/constants/time";
import type { ExpenseBudgetPlanOption } from "@/types/expenses-manager";

type Props = {
	allPlans?: ExpenseBudgetPlanOption[];
	selectedPlanId: string;
	planKind?: string;
	onPlanIdChange: (planId: string) => void;
	month: MonthKey;
	onMonthChange: (month: MonthKey) => void;
	year: number;
	onYearChange: (year: number) => void;
	years: number[];
	distributeAllMonths: boolean;
	onDistributeAllMonthsChange: (value: boolean) => void;
	distributeAllYears: boolean;
	onDistributeAllYearsChange: (value: boolean) => void;
};

export default function AddExpensePeriodControls({
	allPlans,
	selectedPlanId,
	planKind,
	onPlanIdChange,
	month,
	onMonthChange,
	year,
	onYearChange,
	years,
	distributeAllMonths,
	onDistributeAllMonthsChange,
	distributeAllYears,
	onDistributeAllYearsChange,
}: Props) {
	const isEventPlan = planKind === "holiday" || planKind === "carnival";
	const distributeMonthsLabel =
		planKind === "holiday"
			? "Distribute up to travel month"
			: planKind === "carnival"
				? "Distribute up to event month"
				: "Distribute across all months";

	return (
		<>
			<div className="grid grid-cols-2 gap-6">
				{allPlans && allPlans.length > 1 ? (
					<label className="block col-span-2">
						<span className="text-sm font-medium text-slate-300 mb-2 block">Budget Plan</span>
						<SelectDropdown
							name="_budgetPlanSelect"
							value={selectedPlanId}
							onValueChange={onPlanIdChange}
							options={allPlans.map((p) => ({
								value: p.id,
								label: `${p.name} (${p.kind.charAt(0).toUpperCase() + p.kind.slice(1)})`,
							}))}
							buttonClassName="focus:ring-purple-500/50"
						/>
					</label>
				) : null}

				<label className="block col-span-1">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Month</span>
					<SelectDropdown
						name="_monthSelect"
						value={month}
						onValueChange={(v) => onMonthChange(v as MonthKey)}
						options={MONTHS.map((m) => ({ value: m, label: formatMonthKeyLabel(m) }))}
						buttonClassName="focus:ring-purple-500/50"
					/>
				</label>

				<label className="block col-span-1">
					<span className="text-sm font-medium text-slate-300 mb-2 block">Year</span>
					<SelectDropdown
						name="_yearSelect"
						value={String(year)}
						onValueChange={(v) => onYearChange(Number(v))}
						options={years.map((y) => ({ value: String(y), label: String(y) }))}
						buttonClassName="focus:ring-purple-500/50"
					/>
				</label>
			</div>

			<div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
				<label className="flex items-center gap-2 text-sm text-slate-300 select-none">
					<input
						type="checkbox"
						name="distributeMonths"
						checked={distributeAllMonths}
						onChange={(e) => onDistributeAllMonthsChange(e.target.checked)}
						className="h-4 w-4 rounded border-white/20 bg-slate-900/60 text-purple-500 focus:ring-purple-500"
					/>
					{distributeMonthsLabel}
				</label>
				{isEventPlan ? (
					<label className="flex items-center gap-2 text-sm text-slate-300 select-none">
						<input
							type="checkbox"
							name="distributeYears"
							checked={distributeAllYears}
							onChange={(e) => onDistributeAllYearsChange(e.target.checked)}
							className="h-4 w-4 rounded border-white/20 bg-slate-900/60 text-purple-500 focus:ring-purple-500"
						/>
						Distribute across years
					</label>
				) : null}
			</div>
		</>
	);
}
