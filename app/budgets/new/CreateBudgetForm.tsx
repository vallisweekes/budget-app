"use client";

import { useMemo, useState } from "react";
import Card from "@/components/Card";
import SelectDropdown from "@/components/SelectDropdown";

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
							onValueChange={(v) => setBudgetType(v as BudgetType)}
							options={options}
							variant="dark"
							buttonClassName="bg-slate-950/40 px-3 py-2"
						/>
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
