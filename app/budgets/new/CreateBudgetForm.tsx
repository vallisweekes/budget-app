"use client";

import { useMemo, useState } from "react";
import { Card, SelectDropdown } from "@/components/Shared";

const BUDGET_TYPES = ["personal", "holiday", "carnival"] as const;
export type BudgetType = (typeof BUDGET_TYPES)[number];

export default function CreateBudgetForm({
	action,
	defaultBudgetType = "personal",
	hasPersonalPlan = false,
	returnTo,
}: {
	action: (formData: FormData) => void;
	defaultBudgetType?: BudgetType;
	hasPersonalPlan?: boolean;
	returnTo?: string;
}) {
	const initialBudgetType: BudgetType = hasPersonalPlan ? defaultBudgetType : "personal";
	const [budgetType, setBudgetType] = useState<BudgetType>(initialBudgetType);
	const [planName, setPlanName] = useState<string>(initialBudgetType === "personal" ? "Personal" : "");

	const options = useMemo(() => {
		const visibleTypes = hasPersonalPlan ? BUDGET_TYPES : (["personal"] as const);
		return visibleTypes.map((t) => {
			const isPersonal = t === "personal";
			const disabled = Boolean(hasPersonalPlan && isPersonal);
			return {
				value: t,
				label: t.charAt(0).toUpperCase() + t.slice(1),
				disabled,
			};
		});
	}, [hasPersonalPlan]);

	return (
		<Card className="mt-8">
			<form action={action} className="space-y-4">
				{returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
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
						{hasPersonalPlan ? (
						<div className="mt-2 text-xs text-slate-400">
							Personal budget already exists — you can create Holiday/Carnival plans.
						</div>
						) : (
							<div className="mt-2 text-xs text-slate-400">
								Create your Personal budget first — Holiday/Carnival budgets unlock after that.
							</div>
						)}
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
					Create {budgetType.charAt(0).toUpperCase() + budgetType.slice(1)} plan
				</button>

				<div className="text-xs text-slate-400">Starts empty — you’ll add categories, income, and expenses next.</div>
			</form>
		</Card>
	);
}
