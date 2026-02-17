"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Calendar, Check, X } from "lucide-react";
import type { MonthKey } from "@/types";
import CategoryIcon from "./CategoryIcon";
import PaymentStatusButton from "./PaymentStatusButton";
import { formatCurrency } from "@/lib/helpers/money";
import { getSimpleColorClasses } from "@/lib/helpers/colors";
import { updateExpenseDueDate } from "@/lib/expenses/actions";

interface Expense {
	id: string;
	name: string;
	amount: number;
	paid: boolean;
	paidAmount?: number;
	dueDate?: string; // ISO date string (YYYY-MM-DD)
}

interface ExpandableCategoryProps {
	categoryName: string;
	categoryIcon: string;
	categoryColor?: string;
	expenses: Expense[];
	total: number;
	month: MonthKey;
	defaultDueDate: number;
	budgetPlanId: string;
	updatePaymentStatus: (month: MonthKey, id: string, status: "paid" | "unpaid" | "partial", partialAmount?: number) => Promise<void>;
}

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function ExpandableCategory({
	categoryName,
	categoryIcon,
	categoryColor = "blue",
	expenses,
	total,
	month,
	defaultDueDate,
	budgetPlanId,
	updatePaymentStatus,
}: ExpandableCategoryProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
	const [tempDueDate, setTempDueDate] = useState("");
	const [isPending, startTransition] = useTransition();
	const colors = getSimpleColorClasses(categoryColor, "blue");

	const handleEditDueDate = (expense: Expense) => {
		setEditingDueDateId(expense.id);
		setTempDueDate(expense.dueDate || "");
	};

	const handleSaveDueDate = async (expenseId: string, budgetPlanId: string) => {
		const dueDateValue = tempDueDate.trim() === "" ? null : tempDueDate.trim();
		
		// Validate date format (YYYY-MM-DD)
		if (dueDateValue && !/^\d{4}-\d{2}-\d{2}$/.test(dueDateValue)) {
			alert("Please enter a valid date");
			return;
		}

		startTransition(async () => {
			await updateExpenseDueDate(budgetPlanId, month, expenseId, dueDateValue);
			setEditingDueDateId(null);
			window.location.reload(); // Refresh to show updated data
		});
	};

	const handleCancelDueDate = () => {
		setEditingDueDateId(null);
		setTempDueDate("");
	};

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-xl shadow-xl border border-white/10 overflow-hidden">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
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
					{isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
				</div>
			</button>
			
			{isExpanded && (
				<div className="border-t border-white/10 bg-slate-900/20">
					<div className="divide-y divide-white/5">
						{expenses.map((e) => {
							const isEditing = editingDueDateId === e.id;
									const safeDefaultDueDate =
										typeof defaultDueDate === "number" && Number.isFinite(defaultDueDate)
											? defaultDueDate
											: null;
									const dueDateFormatted = e.dueDate
										? new Date(e.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
										: safeDefaultDueDate != null
											? `Day ${safeDefaultDueDate}`
											: "No due date";
							
							return (
								<div key={e.id} className="flex items-start justify-between gap-2 sm:gap-3 p-2 sm:p-3 px-3 sm:px-4 hover:bg-white/5 transition-colors">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5 mb-1 flex-wrap">
											<div className="text-xs sm:text-sm font-medium text-white leading-tight">{e.name}</div>
											
											{/* Due Date Display/Edit */}
											{!isEditing && (
												<span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
													e.dueDate 
														? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' 
														: 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
												}`}>
													Due: {dueDateFormatted}
												</span>
											)}
										</div>
										<div className="flex items-center gap-2 flex-wrap">
											<div className="text-sm sm:text-base font-bold text-slate-200"><Currency value={e.amount} /></div>
											
											{/* Due Date Edit */}
											{isEditing && (
												<div className="flex items-center gap-1.5">
													<input
														type="date"
														value={tempDueDate}
														onChange={(e) => setTempDueDate(e.target.value)}
														className="px-2 py-0.5 bg-slate-900/60 border border-white/20 text-white text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
														autoFocus
														disabled={isPending}
													/>
													<button
														onClick={() => handleSaveDueDate(e.id, budgetPlanId)}
														disabled={isPending}
														className="p-0.5 hover:bg-green-500/20 rounded text-green-400 disabled:opacity-50"
													>
														<Check size={14} />
													</button>
													<button
														onClick={handleCancelDueDate}
														disabled={isPending}
														className="p-0.5 hover:bg-red-500/20 rounded text-red-400 disabled:opacity-50"
													>
														<X size={14} />
													</button>
												</div>
											)}
										</div>
									</div>
									<PaymentStatusButton
										expenseName={e.name}
										amount={e.amount}
										paid={e.paid}
										paidAmount={e.paidAmount || 0}
										month={month}
										id={e.id}
										updatePaymentStatus={updatePaymentStatus}
									/>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
