"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { SyntheticEvent } from "react";
import type { MonthKey } from "@/types";
import { buildYears } from "@/lib/helpers/budget/years";
import type { AddExpenseFormProps, ExpenseCategoryOption } from "@/types/expenses-manager";
import { addExpenseAction } from "@/app/admin/expenses/actions";
import AddExpensePeriodControls from "@/components/Expenses/ExpenseManager/AddExpensePeriodControls";
import AddExpenseDetailsFields from "@/components/Expenses/ExpenseManager/AddExpenseDetailsFields";

export default function AddExpenseForm({
	budgetPlanId,
	month,
	year,
	categories,
	allPlans,
	allCategoriesByPlan,
	horizonYearsByPlan,
	budgetHorizonYears,
	isBusy,
	onAdded,
	onError,
}: AddExpenseFormProps) {
	const [isPending, startTransition] = useTransition();
	const disabled = Boolean(isBusy) || isPending;

	const [error, setError] = useState<string | null>(null);
	const [addMonth, setAddMonth] = useState<MonthKey>(month);
	const [addYear, setAddYear] = useState<number>(year);
	const [addBudgetPlanId, setAddBudgetPlanId] = useState<string>(budgetPlanId);
	const [distributeAllMonths, setDistributeAllMonths] = useState(false);
	const [distributeAllYears, setDistributeAllYears] = useState(false);

	useEffect(() => {
		setError(null);
		setAddMonth(month);
		setAddYear(year);
		setAddBudgetPlanId(budgetPlanId);
		setDistributeAllMonths(false);
		setDistributeAllYears(false);
	}, [budgetPlanId, month, year]);

	const baseYear = useMemo(() => new Date().getFullYear(), []);
	const getYearsForPlan = useMemo(() => {
		return (planId: string): number[] => {
			const horizonRaw = (horizonYearsByPlan && planId ? horizonYearsByPlan[planId] : undefined) ?? budgetHorizonYears ?? 10;
			return buildYears(baseYear, horizonRaw);
		};
	}, [baseYear, budgetHorizonYears, horizonYearsByPlan]);

	const years = useMemo(() => getYearsForPlan(addBudgetPlanId), [addBudgetPlanId, getYearsForPlan]);

	const addFormCategories: ExpenseCategoryOption[] = useMemo(() => {
		if (addBudgetPlanId && allCategoriesByPlan && allCategoriesByPlan[addBudgetPlanId]?.length) {
			return allCategoriesByPlan[addBudgetPlanId];
		}
		return categories;
	}, [addBudgetPlanId, allCategoriesByPlan, categories]);

	const selectedPlanKind = useMemo(() => {
		return allPlans?.find((p) => p.id === addBudgetPlanId)?.kind ?? "personal";
	}, [addBudgetPlanId, allPlans]);

	useEffect(() => {
		if (selectedPlanKind === "personal") {
			setDistributeAllYears(false);
		}
	}, [selectedPlanKind]);

	const submit = (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		const formData = new FormData(event.currentTarget);
		startTransition(() => {
			void (async () => {
				try {
					await addExpenseAction(formData);
					onAdded();
				} catch {
					const message = "Could not add expense. Please try again.";
					setError(message);
					onError(message);
				}
			})();
		});
	};

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-white/10">
			<form onSubmit={submit} className="space-y-6">
				<input type="hidden" name="budgetPlanId" value={addBudgetPlanId} />
				<input type="hidden" name="month" value={addMonth} />
				<input type="hidden" name="year" value={addYear} />

				<AddExpensePeriodControls
					allPlans={allPlans}
					selectedPlanId={addBudgetPlanId}
					planKind={selectedPlanKind}
					onPlanIdChange={(v) => {
						setAddBudgetPlanId(v);
						setError(null);
						const nextYears = getYearsForPlan(v);
						setAddYear((prev) => (nextYears.includes(prev) ? prev : (nextYears[0] ?? prev)));
					}}
					month={addMonth}
					onMonthChange={setAddMonth}
					year={addYear}
					onYearChange={setAddYear}
					years={years}
					distributeAllMonths={distributeAllMonths}
					onDistributeAllMonthsChange={setDistributeAllMonths}
					distributeAllYears={distributeAllYears}
					onDistributeAllYearsChange={setDistributeAllYears}
				/>

				<AddExpenseDetailsFields categories={addFormCategories} planKind={selectedPlanKind} />

				<button
					type="submit"
					disabled={disabled}
					className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl py-3 font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{disabled ? "Adding…" : "Add Expense"}
				</button>

				{error ? <p className="text-sm text-red-200">{error}</p> : null}
			</form>
		</div>
	);
}
