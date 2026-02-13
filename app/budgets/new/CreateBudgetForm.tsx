"use client";

import { useMemo, useState } from "react";
import { Card, SelectDropdown } from "@/components/Shared";

const BUDGET_TYPES = ["personal", "holiday", "carnival"] as const;
export type BudgetType = (typeof BUDGET_TYPES)[number];

export default function CreateBudgetForm({
	action,
	defaultBudgetType = "personal",
}: {
	action: (formData: FormData) => void;
	defaultBudgetType?: BudgetType;
}) {
	const [budgetType, setBudgetType] = useState<BudgetType>(defaultBudgetType);
	const [planName, setPlanName] = useState<string>(defaultBudgetType === "personal" ? "Personal" : "");

	const options = useMemo(
		() =>
			BUDGET_TYPES.map((t) => ({
				value: t,
				label: t.charAt(0).toUpperCase() + t.slice(1),
			})),
		[]
	);

	return (
		<Card className="mt-8">
			<form action={action} className="space-y-4">
				<label className="block">
					<span className="block text-sm font-medium text-slate-300">Budget type</span>
					<div className="mt-1">
						<SelectDropdown
							name="budgetType"
							value={budgetType}
							onValueChange={(v) => {
								const next = v as BudgetType;
								setBudgetType(next);
								setPlanName((prev) => {
									// If the user already typed something, keep it.
									if (prev.trim()) return prev;
									return next === "personal" ? "Personal" : "";
								});
							}}
							options={options}
							variant="dark"
							buttonClassName="bg-slate-950/40 px-3 py-2"
						/>
					</div>
				</label>

				<label className="block">
					<span className="block text-sm font-medium text-slate-300">Budget name</span>
					<input
						name="planName"
						value={planName}
						onChange={(e) => setPlanName(e.target.value)}
						placeholder={
							budgetType === "holiday"
								? "e.g. Jamaica 2026"
								: budgetType === "carnival"
									? "e.g. Carnival 2026"
									: "Personal"
						}
						className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
					/>
					<div className="mt-1 text-xs text-slate-400">
						{budgetType === "personal"
							? "Only one Personal budget is allowed."
							: "You can create multiple budgets of this type."}
					</div>
				</label>

				<button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">
					Create budget
				</button>

				<div className="text-xs text-slate-400">Starts empty — you’ll add categories, income, and expenses next.</div>
			</form>
		</Card>
	);
}
