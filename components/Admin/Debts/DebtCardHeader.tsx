"use client";

import { Check, Pencil, X } from "lucide-react";
import type { ComponentType } from "react";
import DeleteDebtButton from "./DeleteDebtButton";
import type { DebtCardDebt } from "@/types/components/debts";

export default function DebtCardHeader(props: {
	debt: DebtCardDebt;
	Icon: ComponentType<{ className?: string }>;
	typeLabels: Record<string, string>;
	canDeleteDebt: boolean;
	isEditing: boolean;
	isCollapsed: boolean;
	editName: string;
	isPending: boolean;
	onToggleCollapsed: () => void;
	onEditNameChange: (next: string) => void;
	onEdit: () => void;
	onSave: () => void;
	onCancel: () => void;
	budgetPlanId: string;
}) {
	const {
		debt,
		Icon,
		typeLabels,
		canDeleteDebt,
		isEditing,
		isCollapsed,
		editName,
		isPending,
		onToggleCollapsed,
		onEditNameChange,
		onEdit,
		onSave,
		onCancel,
		budgetPlanId,
	} = props;

	return (
		<div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
			<button
				onClick={() => (!isEditing ? onToggleCollapsed() : null)}
				type="button"
				className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left cursor-pointer"
				aria-expanded={!isCollapsed}
			>
				<div className="p-2 sm:p-2.5 bg-red-500/10 backdrop-blur-sm rounded-full shrink-0">
					<Icon className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
				</div>
				{isEditing ? (
					<div className="flex-1 min-w-0">
						<input
							type="text"
							value={editName}
							onChange={(e) => onEditNameChange(e.target.value)}
							className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg text-sm sm:text-base font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
							placeholder="Debt name"
						/>
					</div>
				) : (
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
							<h3 className="text-sm sm:text-base font-bold text-white truncate">{debt.name}</h3>
							{debt.sourceType === "expense" && (
								<span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[10px] font-semibold text-amber-400 shrink-0">
									From Expense
								</span>
							)}
						</div>
						<p className="text-[10px] sm:text-xs text-slate-400 truncate">
							{debt.sourceType === "expense" && debt.sourceExpenseName
								? `${debt.sourceCategoryName || ""} → ${debt.sourceExpenseName}${
									debt.sourceMonthKey ? ` (${debt.sourceMonthKey})` : ""
								}`
								: typeLabels[debt.type as keyof typeof typeLabels]}
						</p>
					</div>
				)}
			</button>

			<div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
				{isEditing ? (
					<>
						<button
							onClick={onSave}
							disabled={isPending}
							className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-60"
							title="Save"
						>
							<Check size={14} className="sm:w-[18px] sm:h-[18px]" />
						</button>
						<button
							onClick={onCancel}
							disabled={isPending}
							className="p-1.5 sm:p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-60"
							title="Cancel"
						>
							<X size={14} className="sm:w-[18px] sm:h-[18px]" />
						</button>
					</>
				) : (
					<>
						<button
							onClick={onEdit}
							className="p-1.5 sm:p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
							title="Edit debt"
						>
							<Pencil size={14} className="sm:w-[18px] sm:h-[18px]" />
						</button>
						{canDeleteDebt ? (
							<DeleteDebtButton debtId={debt.id} debtName={debt.name} budgetPlanId={budgetPlanId} />
						) : null}
					</>
				)}
			</div>
		</div>
	);
}
