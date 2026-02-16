"use client";

import { useState, useTransition } from "react";
import type { MonthKey } from "@/types";
import { useRouter } from "next/navigation";
import { currentMonthKey, monthKeyToNumber } from "@/lib/helpers/monthKey";
import {
	updateIncomeItemAction,
	addIncomeAction,
} from "./actions";
import { Check, X, Plus, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/money";
import DeleteIncomeButton from "./DeleteIncomeButton";

interface IncomeItem {
	id: string;
	name: string;
	amount: number;
}

interface IncomeManagerProps {
	month: MonthKey;
	incomeItems: IncomeItem[];
	budgetPlanId: string;
	onOpen: () => void;
	onClose: () => void;
}

export default function IncomeManager({
	month,
	incomeItems,
	budgetPlanId,
	onOpen,
	onClose,
}: IncomeManagerProps) {
	const nowMonth = currentMonthKey();
	const isCurrentMonth = month === nowMonth;
	const isLocked = monthKeyToNumber(month) < monthKeyToNumber(nowMonth);
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [editingItemId, setEditingItemId] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState(false);
	const [editName, setEditName] = useState("");
	const [editAmount, setEditAmount] = useState("");
	const [newName, setNewName] = useState("");
	const [newAmount, setNewAmount] = useState("");
	const [distributeAllMonths, setDistributeAllMonths] = useState(false);
	const [distributeAllYears, setDistributeAllYears] = useState(false);

	const handleEditClick = (id: string) => {
		if (isLocked) return;
		const item = incomeItems.find((i) => i.id === id);
		if (item) {
			setEditName(item.name);
			setEditAmount(item.amount.toString());
		}
		setEditingItemId(id);
		onOpen();
	};

	const handleCancel = () => {
		setEditingItemId(null);
		setIsAdding(false);
		onClose();
	};

	const handleAddClick = () => {
		if (isLocked) return;
		setNewName("");
		setNewAmount("");
		setDistributeAllMonths(false);
		setDistributeAllYears(false);
		setIsAdding(true);
		onOpen();
	};

	const handleConfirmAdd = () => {
		if (isLocked) return;
		const name = newName.trim();
		const amount = Number(newAmount);
		if (!name) return;
		if (!Number.isFinite(amount) || amount <= 0) return;

		startTransition(async () => {
			const formData = new FormData();
			formData.set("budgetPlanId", budgetPlanId);
			formData.set("month", month);
			formData.set("name", name);
			formData.set("amount", String(amount));
			if (distributeAllMonths) formData.set("distributeMonths", "on");
			if (distributeAllYears) formData.set("distributeYears", "on");
			await addIncomeAction(formData);
			setIsAdding(false);
			onClose();
			router.refresh();
		});
	};

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
							<form
								className="w-full flex items-center gap-2"
								onSubmit={(e) => {
									e.preventDefault();
									if (editName.trim() && editAmount) {
										startTransition(async () => {
											await updateIncomeItemAction(
												budgetPlanId,
												month,
												item.id,
												editName,
												parseFloat(editAmount)
											);
											setEditingItemId(null);
											onClose();
											router.refresh();
										});
									}
								}}
							>
								<label className="flex-1">
									<span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-0.5 sm:mb-1">Name</span>
									<input
										type="text"
										value={editName}
										onChange={(e) => setEditName(e.target.value)}
										className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
										placeholder="Name"
										aria-label="Income name"
									/>
								</label>
								<label className="w-24 sm:w-28">
									<span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-0.5 sm:mb-1">Amount</span>
									<input
										type="number"
										step="0.01"
										value={editAmount}
										onChange={(e) => setEditAmount(e.target.value)}
										className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
										placeholder="Amount"
										aria-label="Income amount"
									/>
								</label>
								<div className="flex items-center gap-2">
									<button
										type="submit"
										className="p-1 sm:p-1.5 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30"
									>
										<Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
									</button>
									<button
										type="button"
										onClick={handleCancel}
										className="p-1 sm:p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30"
									>
										<X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
									</button>
								</div>
							</form>
						) : (
							<>
								<span className="text-slate-300 text-xs sm:text-sm">{item.name}</span>
								<div className="flex items-center gap-2">
									<span className="text-slate-200 font-semibold text-xs sm:text-sm">
										{formatCurrency(item.amount)}
									</span>
									{!isLocked && (
										<div className="opacity-90 group-hover:opacity-100 transition-opacity flex items-center gap-1">
											<button
												onClick={() => handleEditClick(item.id)}
												disabled={isPending}
												className="p-1 sm:p-1.5 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
												type="button"
												aria-label={`Edit ${item.name}`}
											>
												<Pencil className="w-3 h-3" />
											</button>
											<DeleteIncomeButton id={item.id} budgetPlanId={budgetPlanId} month={month} />
										</div>
									)}
								</div>
							</>
						)}
					</li>
					))
				)}
			</ul>

			{isLocked ? null : isAdding ? (
				<div className="p-1.5 sm:p-2 bg-slate-900/40 rounded-lg border border-white/10">
					<div className="flex items-center gap-2">
						<label className="flex-1">
							<span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-0.5 sm:mb-1">Name</span>
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								disabled={isPending}
								className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
								placeholder="Income name"
								aria-label="New income name"
								autoFocus
							/>
						</label>
						<label className="w-24 sm:w-28">
							<span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-0.5 sm:mb-1">Amount</span>
							<input
								type="number"
								step="0.01"
								value={newAmount}
								onChange={(e) => setNewAmount(e.target.value)}
								disabled={isPending}
								className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
								placeholder="Amount"
								aria-label="New income amount"
							/>
						</label>
						{isPending && (
							<div
								className="flex items-center gap-2 text-xs text-slate-300 px-2"
								aria-live="polite"
							>
								<span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400/60 border-t-transparent animate-spin" />
								Saving…
							</div>
						)}
						<button
							type="button"
							onClick={handleConfirmAdd}
							disabled={isPending}
							className="p-1.5 sm:p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
							title="Add"
						>
							<Check size={16} />
						</button>
						<button
							onClick={handleCancel}
							disabled={isPending}
							className="p-1.5 sm:p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
							title="Cancel"
						>
							<X size={16} />
						</button>
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] sm:text-xs text-slate-300">
						<label className="flex items-center gap-2 select-none">
							<input
								type="checkbox"
								checked={distributeAllMonths}
								onChange={(e) => setDistributeAllMonths(e.target.checked)}
								disabled={isPending}
								className={`h-4 w-4 rounded border-white/20 bg-slate-900/60 ${
									isCurrentMonth ? "text-teal-300 focus:ring-teal-300" : "text-purple-500 focus:ring-purple-500"
								}`}
							/>
							All months
						</label>
						<label className="flex items-center gap-2 select-none">
							<input
								type="checkbox"
								checked={distributeAllYears}
								onChange={(e) => setDistributeAllYears(e.target.checked)}
								disabled={isPending}
								className={`h-4 w-4 rounded border-white/20 bg-slate-900/60 ${
									isCurrentMonth ? "text-teal-300 focus:ring-teal-300" : "text-purple-500 focus:ring-purple-500"
								}`}
							/>
							All years (all budgets)
						</label>
					</div>
				</div>
			) : (
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
					Add Income
				</button>
			)}
		</div>
	);
}
