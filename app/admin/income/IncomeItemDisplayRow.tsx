"use client";

import { Pencil } from "lucide-react";
import type { MonthKey } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";
import DeleteIncomeButton from "./DeleteIncomeButton";

type IncomeItem = {
	id: string;
	name: string;
	amount: number;
};

export default function IncomeItemDisplayRow(props: {
	item: IncomeItem;
	budgetPlanId: string;
	year: number;
	month: MonthKey;
	isLocked: boolean;
	isPending: boolean;
	onEdit: () => void;
}) {
	const { item, budgetPlanId, year, month, isLocked, isPending, onEdit } = props;

	return (
		<>
			<span className="text-slate-300 text-xs sm:text-sm">{item.name}</span>
			<div className="flex items-center gap-2">
				<span className="text-slate-200 font-semibold text-xs sm:text-sm">{formatCurrency(item.amount)}</span>
				{!isLocked && (
					<div className="opacity-90 group-hover:opacity-100 transition-opacity flex items-center gap-1">
						<button
							onClick={onEdit}
							disabled={isPending}
							className="p-1 sm:p-1.5 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
							type="button"
							aria-label={`Edit ${item.name}`}
						>
							<Pencil className="w-3 h-3" />
						</button>
						<DeleteIncomeButton id={item.id} budgetPlanId={budgetPlanId} year={year} month={month} />
					</div>
				)}
			</div>
		</>
	);
}
