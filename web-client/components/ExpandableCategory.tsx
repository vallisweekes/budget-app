"use client";

import { usePathname, useRouter } from "next/navigation";
import type { MonthKey } from "@/types";
import CategoryIcon from "./CategoryIcon";
import { formatCurrency } from "@/lib/helpers/money";
import { getSimpleColorClasses } from "@/lib/helpers/colors";
import { buildScopedPageHrefForPlan } from "@/lib/helpers/scopedPageHref";

interface Expense {
	id: string;
	name: string;
	amount: number;
	paid: boolean;
	paidAmount?: number;
	dueDate?: string; // ISO date string (YYYY-MM-DD)
}

interface ExpandableCategoryProps {
	categoryId: string;
	categoryName: string;
	categoryIcon: string;
	categoryColor?: string;
	expenses: Expense[];
	total: number;
	month: MonthKey;
	year: number;
	budgetPlanId: string;
}

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function ExpandableCategory({
	categoryId,
	categoryName,
	categoryIcon,
	categoryColor = "blue",
	expenses,
	total,
	month,
	year,
	budgetPlanId,
}: ExpandableCategoryProps) {
	const router = useRouter();
	const pathname = usePathname();
	const colors = getSimpleColorClasses(categoryColor, "blue");

	const openInExpensesManager = () => {
		const base = buildScopedPageHrefForPlan(pathname, budgetPlanId, "expense-category");
		router.push(
			`${base}/${encodeURIComponent(categoryId)}?year=${encodeURIComponent(String(year))}&month=${encodeURIComponent(month)}`
		);
	};

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-xl shadow-xl border border-white/10 overflow-hidden">
			<button
				onClick={openInExpensesManager}
				className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer"
			>
				<div className="flex items-center gap-4">
					<div className={`w-14 h-14 flex items-center justify-center bg-gradient-to-br ${colors.bg} rounded-2xl shadow-md`}>
						<CategoryIcon iconName={categoryIcon} size={28} className="text-white" />
					</div>
					<div>
						<div className="font-semibold text-left text-white">{categoryName}</div>
						<div className="text-sm text-slate-400">{expenses.length} items</div>
					</div>
				</div>
				<div className="flex items-center gap-4">
					<div className="text-right">
						<div className="font-bold text-lg text-white"><Currency value={total} /></div>
						<div className="text-xs text-slate-400">per month</div>
					</div>
				</div>
			</button>
		</div>
	);
}
