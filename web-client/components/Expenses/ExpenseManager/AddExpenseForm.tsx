"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { SyntheticEvent } from "react";
import type { MonthKey } from "@/types";
import { buildYears } from "@/lib/helpers/budget/years";
import type { AddExpenseFormProps, ExpenseCategoryOption } from "@/types/expenses-manager";
import { addExpenseAction } from "@/app/admin/expenses/actions";
import AddExpensePeriodControls from "@/components/Expenses/ExpenseManager/AddExpensePeriodControls";
import AddExpenseDetailsFields from "@/components/Expenses/ExpenseManager/AddExpenseDetailsFields";
import ReceiptUploadPanel from "@/components/Expenses/ExpenseManager/ReceiptUploadPanel";

type Mode = "manual" | "receipt";

export default function AddExpenseForm({
	budgetPlanId,
	month,
	year,
	categories,
	creditCards,
	creditCardsByPlan,
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

	const [mode, setMode] = useState<Mode>("manual");
	const [error, setError] = useState<string | null>(null);
	const [addMonth, setAddMonth] = useState<MonthKey>(month);
	const [addYear, setAddYear] = useState<number>(year);
	const [addBudgetPlanId, setAddBudgetPlanId] = useState<string>(budgetPlanId);
	const [distributeAllMonths, setDistributeAllMonths] = useState(false);
	const [distributeAllYears, setDistributeAllYears] = useState(false);

	useEffect(() => {
		/* eslint-disable react-hooks/set-state-in-effect */
		setError(null);
		setAddMonth(month);
		setAddYear(year);
		setAddBudgetPlanId(budgetPlanId);
		setDistributeAllMonths(false);
		setDistributeAllYears(false);
		/* eslint-enable react-hooks/set-state-in-effect */
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

	const addFormCreditCards = useMemo(() => {
		if (addBudgetPlanId && creditCardsByPlan && Array.isArray(creditCardsByPlan[addBudgetPlanId])) {
			return creditCardsByPlan[addBudgetPlanId] ?? [];
		}
		return creditCards ?? [];
	}, [addBudgetPlanId, creditCards, creditCardsByPlan]);

	const selectedPlanKind = useMemo(() => {
		return allPlans?.find((p) => p.id === addBudgetPlanId)?.kind ?? "personal";
	}, [addBudgetPlanId, allPlans]);

	useEffect(() => {
		if (selectedPlanKind === "personal") {
			// This syncs a derived UI constraint when the plan kind changes.
			// eslint-disable-next-line react-hooks/set-state-in-effect
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
			{/* Mode toggle */}
			<div className="flex gap-1 rounded-2xl bg-slate-900/50 p-1 mb-6">
				<button
					type="button"
					onClick={() => setMode("manual")}
					className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
						mode === "manual"
							? "bg-purple-600 text-white shadow"
							: "text-slate-400 hover:text-white"
					}`}
				>
					<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
					</svg>
					Manual Entry
				</button>
				<button
					type="button"
					onClick={() => setMode("receipt")}
					className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
						mode === "receipt"
							? "bg-purple-600 text-white shadow"
							: "text-slate-400 hover:text-white"
					}`}
				>
					<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M16 10l-4-4m0 0L8 10m4-4v12" />
					</svg>
					Upload Receipt
				</button>
			</div>

			{/* Receipt upload panel */}
			{mode === "receipt" && (
				<ReceiptUploadPanel
					budgetPlanId={addBudgetPlanId}
					month={addMonth}
					year={addYear}
					categories={addFormCategories}
					onAdded={onAdded}
					onError={onError}
				/>
			)}

			{/* Manual entry form */}
			{mode === "manual" && (
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

				<AddExpenseDetailsFields
					categories={addFormCategories}
					planKind={selectedPlanKind}
					creditCards={addFormCreditCards}
				/>

				<button
					type="submit"
					disabled={disabled}
					className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl py-3 font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{disabled ? "Adding…" : "Add Expense"}
				</button>

				{error ? <p className="text-sm text-red-200">{error}</p> : null}
			</form>
			)}
		</div>
	);
}
