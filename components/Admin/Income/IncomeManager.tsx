"use client";

import { Plus } from "lucide-react";
import type { MonthKey } from "@/types";
import IncomeItemEditForm from "./IncomeItemEditForm";
import IncomeItemDisplayRow from "./IncomeItemDisplayRow";
import IncomeAddFormRow from "./IncomeAddFormRow";
import type { IncomeItem } from "@/types";
import { useIncomeManager } from "@/lib/hooks/income/useIncomeManager";

interface IncomeManagerProps {
	year: number;
	month: MonthKey;
	incomeItems: IncomeItem[];
	budgetPlanId: string;
	onOpen: () => void;
	onClose: () => void;
}

export default function IncomeManager({
	year,
	month,
	incomeItems,
	budgetPlanId,
	onOpen,
	onClose,
}: IncomeManagerProps) {
	const {
		isCurrentMonth,
		isLocked,
		canAddForMonth,
		isPending,
		editingItemId,
		isAdding,
		editName,
		editAmount,
		newName,
		newAmount,
		distributeAllMonths,
		distributeAllYears,
		setEditName,
		setEditAmount,
		setNewName,
		setNewAmount,
		setDistributeAllMonths,
		setDistributeAllYears,
		handleEditClick,
		handleCancel,
		handleAddClick,
		handleConfirmAdd,
		handleSubmitEdit,
	} = useIncomeManager({ year, month, incomeItems, budgetPlanId, onOpen, onClose });

	return (
		<div className="flex flex-col h-full">
			<ul className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 flex-1">
				{incomeItems.length === 0 ? (
					<li className="rounded-xl border border-dashed border-white/10 bg-slate-900/20 px-3 sm:px-4 py-3 sm:py-4">
						<div className="text-xs sm:text-sm font-medium text-slate-200">No income yet</div>
						<div className="mt-1 text-[11px] sm:text-xs text-slate-400">Add your salary or any other sources for this month.</div>
					</li>
				) : (
					incomeItems.map((item) => (
						<li
							key={item.id}
							className="group flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
						>
							{editingItemId === item.id ? (
								<IncomeItemEditForm
									item={item}
									editName={editName}
									editAmount={editAmount}
									isPending={isPending}
									onEditNameChange={setEditName}
									onEditAmountChange={setEditAmount}
									onCancel={handleCancel}
									onSubmit={() => {
									handleSubmitEdit(item.id);
									}}
								/>
							) : (
								<IncomeItemDisplayRow
									item={item}
									budgetPlanId={budgetPlanId}
									year={year}
									month={month}
									isLocked={isLocked}
									isPending={isPending}
									onEdit={() => handleEditClick(item.id)}
								/>
							)}
					</li>
					))
				)}
			</ul>

			{isLocked ? null : isAdding ? (
				<IncomeAddFormRow
					newName={newName}
					newAmount={newAmount}
					distributeAllMonths={distributeAllMonths}
					distributeAllYears={distributeAllYears}
					isPending={isPending}
					isCurrentMonth={isCurrentMonth}
					onNewNameChange={setNewName}
					onNewAmountChange={setNewAmount}
					onDistributeAllMonthsChange={setDistributeAllMonths}
					onDistributeAllYearsChange={setDistributeAllYears}
					onConfirmAdd={handleConfirmAdd}
					onCancel={handleCancel}
				/>
			) : canAddForMonth ? (
				<button
					onClick={handleAddClick}
					disabled={isPending}
					className={`w-full flex items-center justify-center gap-2 px-2 py-1.5 sm:p-2 text-xs sm:text-sm rounded-lg border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
						isCurrentMonth
							? "text-teal-200 hover:bg-teal-400/10 border-teal-200/30"
							: "text-purple-400 hover:bg-purple-500/10 border-purple-500/20"
					}`}
				>
					<Plus size={14} className="sm:hidden" />
					<Plus size={16} className="hidden sm:block" />
					{incomeItems.length > 0 ? "Add income source" : "Add Income"}
				</button>
			) : null}
		</div>
	);
}
