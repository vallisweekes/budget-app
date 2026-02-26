"use client";

import type { ExpenseItem, MonthKey } from "@/types";

import { formatCurrency } from "@/lib/helpers/money";
import { getExpenseDuePreviewMeta } from "@/lib/helpers/expenses/expenseDuePreview";

export default function CategorySectionPreviewList({
	previewExpenses,
	expensesCount,
	previewLimit,
	month,
	year,
	payDate,
	onView,
}: {
	previewExpenses: ExpenseItem[];
	expensesCount: number;
	previewLimit: number;
	month: MonthKey;
	year: number;
	payDate: number;
	onView?: () => void;
}) {
	return (
		<div className="divide-y divide-white/10">
			{previewExpenses.map((expense) => {
				const { label, colorClass } = getExpenseDuePreviewMeta({
					paid: Boolean(expense.paid),
					dueDate: expense.dueDate,
					month,
					year,
					payDate,
				});

				return (
					<div key={expense.id} className="px-3 py-2 sm:px-4 sm:py-2.5 hover:bg-slate-900/35 transition">
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0 flex-1">
								<div className="text-sm font-semibold text-slate-100 truncate">{expense.name}</div>
								<div className={`text-[10px] sm:text-xs font-medium mt-0.5 ${colorClass}`}>{label}</div>
							</div>
							<div className="shrink-0 text-sm font-bold text-white">{formatCurrency(expense.amount)}</div>
						</div>
					</div>
				);
			})}

			{expensesCount > previewLimit ? (
				<div className="px-3 py-2 sm:px-4 sm:py-3 bg-slate-900/15">
					<button
						type="button"
						onClick={onView}
						disabled={!onView}
						className="text-xs font-semibold text-slate-200 hover:text-white transition disabled:opacity-60"
					>
						Manage all {expensesCount} expenses
					</button>
				</div>
			) : null}
		</div>
	);
}
