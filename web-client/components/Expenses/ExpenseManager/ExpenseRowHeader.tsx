"use client";

import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";

import type { ExpenseItem, MonthKey } from "@/types";

import { formatCurrency } from "@/lib/helpers/money";
import { monthKeyToNumber } from "@/lib/helpers/monthKey";
import { daysUntilUtc, dueBadgeClasses, formatDueDateLabel, getDueDateUtc } from "@/lib/helpers/expenses/dueDate";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function ExpenseRowHeader({
	expense,
	month,
	year,
	payDate,
	isBusy,
	isPaid,
	disableMarkPaid,
	onTogglePaid,
	onEdit,
	onDelete,
	showDueBadge,
	showAllocationBadge,
	showPartialPaidBadge,
}: {
	expense: ExpenseItem;
	month: MonthKey;
	year: number;
	payDate: number;
	isBusy?: boolean;
	isPaid: boolean;
	disableMarkPaid: boolean;
	onTogglePaid: () => void;
	onEdit: () => void;
	onDelete: () => void;
	showDueBadge: boolean;
	showAllocationBadge: boolean;
	showPartialPaidBadge: boolean;
}) {
	const [logoBroken, setLogoBroken] = useState(false);
	const showLogo = Boolean(expense.logoUrl) && !logoBroken;

	const dueBadge = (() => {
		if (!showDueBadge) return null;
		const monthNumber = monthKeyToNumber(month);
		const dueDateUtc = getDueDateUtc({ year, monthNumber, dueDate: expense.dueDate, payDate });
		const days = daysUntilUtc(dueDateUtc);
		return (
			<span
				className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-lg font-semibold shrink-0 ${dueBadgeClasses(days)}`}
				title={
					days < 0
						? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
						: days === 0
							? "Due today"
							: `Due in ${days} day${days === 1 ? "" : "s"}`
				}
			>
				{formatDueDateLabel(days, dueDateUtc)}
			</span>
		);
	})();

	const showPartialPaid =
		showPartialPaidBadge &&
		expense.paidAmount != null &&
		expense.paidAmount > 0 &&
		expense.paidAmount < expense.amount;

	return (
		<div className="flex items-start justify-between gap-2 sm:gap-3">
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5 mb-0.5 sm:mb-1 flex-wrap">
					<span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-slate-900/60 overflow-hidden shrink-0">
						{showLogo ? (
							<img
								src={expense.logoUrl ?? ""}
								alt={`${expense.name} logo`}
								className="h-4 w-4 object-contain"
								onError={() => setLogoBroken(true)}
							/>
						) : (
							<span className="text-[10px] font-semibold text-slate-300">
								{expense.name.trim().charAt(0).toUpperCase() || "•"}
							</span>
						)}
					</span>
					<div className="font-semibold text-white text-xs sm:text-sm truncate">{expense.name}</div>
					{showAllocationBadge && expense.isAllocation ? (
						<span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-lg font-semibold shrink-0 bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
							Allocation
						</span>
					) : null}
					{dueBadge}
				</div>

				<div className="flex items-center gap-2 text-xs sm:text-sm">
					<span className="text-slate-300 font-medium">
						<Currency value={expense.amount} />
					</span>
					{showPartialPaid ? (
						<span className="text-amber-400 text-xs bg-amber-500/10 px-2 py-1 rounded-lg">
							Paid: <Currency value={expense.paidAmount ?? 0} />
						</span>
					) : null}
				</div>
			</div>

			<div className="flex items-start gap-1.5 sm:gap-2">
				<button
					type="button"
					onClick={onTogglePaid}
					disabled={isBusy || disableMarkPaid}
					className={`h-8 sm:h-9 min-w-[76px] sm:min-w-[88px] px-2 sm:px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] flex items-center justify-center gap-1 sm:gap-1.5 ${
						isPaid
							? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
							: "bg-red-500/20 text-red-400 hover:bg-red-500/30"
					}`}
					aria-label={isPaid ? "Mark as unpaid" : "Mark as paid"}
				>
					{isPaid ? (
						<>
							<Check size={16} className="sm:w-[18px] sm:h-[18px]" />
							<span>Paid</span>
						</>
					) : (
						<span>Unpaid</span>
					)}
				</button>

				<button
					type="button"
					onClick={onEdit}
					disabled={isBusy}
					className="h-8 sm:h-9 w-8 sm:w-9 rounded-lg sm:rounded-xl hover:bg-purple-500/20 text-purple-200 transition-all cursor-pointer hover:scale-[1.05] flex items-center justify-center"
					title="Edit expense"
				>
					<Pencil size={14} className="sm:w-4 sm:h-4" />
				</button>

				<button
					type="button"
					onClick={onDelete}
					disabled={isBusy}
					className="h-8 sm:h-9 w-8 sm:w-9 rounded-lg sm:rounded-xl hover:bg-red-500/20 text-red-400 transition-all cursor-pointer hover:scale-[1.05] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
					title="Delete expense"
				>
					<Trash2 size={14} className="sm:w-4 sm:h-4" />
				</button>
			</div>
		</div>
	);
}
