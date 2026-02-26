"use client";

import CategoryIcon from "@/components/CategoryIcon";
import { formatCurrency } from "@/lib/helpers/money";
import type { ExpenseCategoryOption } from "@/types/expenses-manager";

export default function CategorySectionHeader({
	variant,
	category,
	gradient,
	expensesCount,
	paidCount,
	totalAmount,
	onView,
	isCollapsed,
	onToggleCollapsed,
}: {
	variant: "full" | "preview";
	category: ExpenseCategoryOption;
	gradient: string;
	expensesCount: number;
	paidCount: number;
	totalAmount: number;
	onView?: () => void;
	isCollapsed?: boolean;
	onToggleCollapsed?: () => void;
}) {
	const headerInner = (
		<div className="flex items-center justify-between gap-2 sm:gap-3">
			<div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
				<div
					className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br ${gradient} rounded-xl sm:rounded-2xl shadow-lg shrink-0`}
				>
					<CategoryIcon iconName={category.icon ?? "Circle"} size={20} className="text-white sm:w-6 sm:h-6" />
				</div>
				<div className="text-left min-w-0 flex-1">
					<h3 className="font-bold text-sm sm:text-base text-white truncate">{category.name}</h3>
					<p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
						{expensesCount} {expensesCount === 1 ? "expense" : "expenses"} · {paidCount} paid
					</p>
				</div>
			</div>

			<div className="flex items-center gap-2 sm:gap-3 shrink-0">
				<div className="text-right">
					<div className="text-base sm:text-xl font-bold text-white">{formatCurrency(totalAmount)}</div>
					{variant === "preview" ? (
						<div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{paidCount} paid</div>
					) : (
						<div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
							{paidCount} / {expensesCount} paid
						</div>
					)}
				</div>

				{variant === "preview" ? (
					<button
						type="button"
						onClick={onView}
						disabled={!onView}
						className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 bg-white/5 hover:bg-white/10 transition disabled:opacity-60"
					>
						Manage
					</button>
				) : null}
			</div>
		</div>
	);

	if (variant === "preview") {
		return (
			<div className="w-full p-3 sm:p-4 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40">
				{headerInner}
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={onToggleCollapsed}
			aria-expanded={!isCollapsed}
			className="w-full p-3 sm:p-4 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40 hover:from-slate-900/80 hover:to-slate-900/60 transition-all cursor-pointer"
		>
			{headerInner}
		</button>
	);
}
