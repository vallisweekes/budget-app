"use client";

import { ArrowLeft } from "lucide-react";
import CreateBudgetForm, { type BudgetType } from "@/app/budgets/new/CreateBudgetForm";

export default function PlansNewView({
	settingsBasePath,
	defaultBudgetType,
	hasPersonalPlan,
	createBudgetPlanAction,
	onBack,
}: {
	settingsBasePath: string;
	defaultBudgetType: BudgetType;
	hasPersonalPlan: boolean;
	createBudgetPlanAction?: (formData: FormData) => void;
	onBack: () => void;
}) {
	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-6 sm:p-8">
			<button
				type="button"
				onClick={onBack}
				className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white transition"
			>
				<ArrowLeft className="h-4 w-4" />
				<span>Back to plans</span>
			</button>

			<div className="mt-4">
				{createBudgetPlanAction ? (
					<CreateBudgetForm
						action={createBudgetPlanAction}
						defaultBudgetType={defaultBudgetType}
						hasPersonalPlan={hasPersonalPlan}
						returnTo={`${settingsBasePath}/plans`}
					/>
				) : (
					<div className="text-sm text-slate-300">Unable to create a plan from this page.</div>
				)}
			</div>
		</div>
	);
}
