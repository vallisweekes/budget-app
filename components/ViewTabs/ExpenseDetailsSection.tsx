"use client";

import Link from "next/link";
import { Receipt, Plus } from "lucide-react";
import ExpandableCategory from "@/components/ExpandableCategory";
import { Card } from "@/components/Shared";
import { buildScopedPageHrefForPlan } from "@/lib/helpers/scopedPageHref";
import type { BudgetPlan, BudgetPlanData, MonthKey, TabKey, UpdatePaymentStatusFn } from "@/types";

export default function ExpenseDetailsSection(props: {
	show: boolean;
	onToggle: () => void;
	pathname: string | null;
	month: MonthKey;
	budgetPlanId: string;
	resolvedActiveTab: TabKey;
	activePlans: BudgetPlan[];
	allPlansData?: Record<string, BudgetPlanData>;
	fallbackPlanData: BudgetPlanData;
	updatePaymentStatus: UpdatePaymentStatusFn;
}) {
	const {
		show,
		onToggle,
		pathname,
		month,
		budgetPlanId,
		resolvedActiveTab,
		activePlans,
		allPlansData,
		fallbackPlanData,
		updatePaymentStatus,
	} = props;

	return (
		<>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="bg-white/10 p-2 rounded-xl shadow-md backdrop-blur-sm">
						<Receipt size={18} className="text-white" />
					</div>
					<h2 className="text-lg font-bold text-white">Expense details</h2>
				</div>
				<button
					type="button"
					onClick={onToggle}
					className="text-sm font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-all"
				>
					{show ? "Hide" : "Show"}
				</button>
			</div>

			{show ? (
				<div className="space-y-4">
					{(activePlans.length > 0
						? activePlans
						: [{ id: budgetPlanId, name: "This plan", kind: resolvedActiveTab, payDate: 27 }]
					).map((plan) => {
						const planData = allPlansData?.[plan.id] ?? (plan.id === budgetPlanId ? fallbackPlanData : undefined);
						if (!planData) return null;

						return (
							<div key={plan.id} className="space-y-3">
								{activePlans.length > 1 && <h3 className="text-base font-bold text-white">{plan.name}</h3>}

								{planData.categoryData.length === 0 ? (
									<Card title="Categories">
										<div className="text-center py-6">
											<div className="text-sm text-slate-400 mb-4">No categorized expenses yet for this month.</div>
											<Link
												href={buildScopedPageHrefForPlan(pathname, plan.id, "expenses")}
												className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
											>
												<Plus size={20} />
												Add Your First Expense
											</Link>
										</div>
									</Card>
								) : (
									planData.categoryData.map((cat) => (
										<ExpandableCategory
											key={cat.id}
											categoryName={cat.name}
											categoryIcon={cat.icon || "Circle"}
											categoryColor={cat.color}
											expenses={(cat.expenses || []).map((e) => ({
												id: e.id,
												name: e.name,
												amount: e.amount,
												paid: Boolean(e.paid),
												paidAmount: e.paidAmount ?? 0,
												dueDate: e.dueDate,
											}))}
											total={cat.total}
											month={month}
											defaultDueDate={plan.payDate}
											budgetPlanId={plan.id}
											updatePaymentStatus={(monthKey, id, status, partialAmount) =>
												updatePaymentStatus(plan.id, monthKey, id, status, partialAmount)
											}
										/>
									))
								)}
							</div>
						);
					})}
				</div>
			) : null}
		</>
	);
}
