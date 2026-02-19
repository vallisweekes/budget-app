"use client";

import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { MonthKey, ExpenseItem } from "@/types";
import CategoryIcon from "@/components/CategoryIcon";
import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import { getSimpleColorClasses } from "@/lib/helpers/colors";
import { formatCurrency } from "@/lib/helpers/money";
import type { CreditCardOption, ExpenseCategoryOption } from "@/types/expenses-manager";
import ExpenseRow from "@/components/Expenses/ExpenseManager/ExpenseRow";

type Props = {
	category: ExpenseCategoryOption;
	expenses: ExpenseItem[];
	planKind: string;
	month: MonthKey;
	year: number;
	payDate: number;
	isBusy?: boolean;
	isCollapsed: boolean;
	onToggleCollapsed: () => void;
	inlineAddOpen: boolean;
	inlineAddError?: string | null;
	onInlineAddOpen: () => void;
	onInlineAddCancel: () => void;
	onInlineAddSubmit: (data: FormData) => void;
	paymentByExpenseId: Record<string, string>;
	onPaymentValueChange: (expenseId: string, value: string) => void;
	paymentSourceByExpenseId: Record<string, string>;
	onPaymentSourceChange: (expenseId: string, value: string) => void;
	creditCards?: CreditCardOption[];
	cardDebtIdByExpenseId: Record<string, string>;
	onCardDebtIdChange: (expenseId: string, value: string) => void;
	onTogglePaid: (expenseId: string) => void;
	onEdit: (expense: ExpenseItem) => void;
	onDelete: (expense: ExpenseItem) => void;
	onApplyPayment: (expenseId: string) => void;
	budgetPlanId: string;
};

export default function CategorySection({
	category,
	expenses,
	planKind,
	month,
	year,
	payDate,
	isBusy,
	isCollapsed,
	onToggleCollapsed,
	inlineAddOpen,
	inlineAddError,
	onInlineAddOpen,
	onInlineAddCancel,
	onInlineAddSubmit,
	paymentByExpenseId,
	onPaymentValueChange,
	paymentSourceByExpenseId,
	onPaymentSourceChange,
	creditCards,
	cardDebtIdByExpenseId,
	onCardDebtIdChange,
	onTogglePaid,
	onEdit,
	onDelete,
	onApplyPayment,
	budgetPlanId,
}: Props) {
	const colors = getSimpleColorClasses(category.color, "blue");
	const gradient = colors.bg;
	const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
	const paidCount = expenses.filter((e) => e.paid).length;

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/10 hover:shadow-2xl transition-all">
			<button
				type="button"
				onClick={onToggleCollapsed}
				className="w-full p-3 sm:p-4 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40 hover:from-slate-900/80 hover:to-slate-900/60 transition-all cursor-pointer"
			>
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
								{expenses.length} {expenses.length === 1 ? "expense" : "expenses"} · Due day {payDate}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2 sm:gap-3 shrink-0">
						<div className="text-right">
							<div className="text-base sm:text-xl font-bold text-white">{formatCurrency(totalAmount)}</div>
							<div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
								{paidCount} / {expenses.length} paid
							</div>
						</div>
						<div className="text-slate-400">
							{isCollapsed ? <ChevronDown size={20} className="sm:w-6 sm:h-6" /> : <ChevronUp size={20} className="sm:w-6 sm:h-6" />}
						</div>
					</div>
				</div>
			</button>

			{!isCollapsed ? (
				<div className="divide-y divide-white/10">
					<div className="p-2 sm:p-4 bg-slate-900/20">
						{inlineAddOpen ? (
							<form
								onSubmit={(e) => {
									e.preventDefault();
									const data = new FormData(e.currentTarget);
									onInlineAddSubmit(data);
								}}
								className="space-y-2"
							>
								<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
								<input type="hidden" name="month" value={month} />
								<input type="hidden" name="year" value={year} />
								<input type="hidden" name="categoryId" value={category.id} />
								<input type="hidden" name="paid" value="false" />

								<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
									<input
										name="name"
										required
										className="sm:col-span-2 w-full px-3 py-2 rounded-xl border border-white/10 bg-slate-900/40 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all"
										placeholder={`Add to ${category.name}…`}
									/>
									<input
										name="amount"
										type="number"
										step="0.01"
										required
										className="w-full px-3 py-2 rounded-xl border border-white/10 bg-slate-900/40 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all"
										placeholder="0.00"
									/>
								</div>

								<div className="flex items-center justify-end gap-2">
									<button
										type="button"
										onClick={onInlineAddCancel}
										className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 border border-white/10 bg-white/5 hover:bg-white/10 transition"
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={isBusy}
										className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-emerald-400/30 bg-emerald-500/20 hover:bg-emerald-500/30 transition disabled:opacity-60"
									>
										<Plus size={14} />
										{isBusy ? "Adding…" : "Add"}
									</button>
								</div>

								{inlineAddError ? <p className="text-xs text-red-200">{inlineAddError}</p> : null}
							</form>
						) : (
							<div className="flex items-center justify-between gap-2">
								<div className="text-[10px] sm:text-xs text-slate-400">
									Add a new expense for {formatMonthKeyLabel(month)} {year}
								</div>
								<button
									type="button"
									onClick={onInlineAddOpen}
									className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-semibold text-white border border-white/10 bg-white/5 hover:bg-white/10 transition"
								>
									<Plus size={14} />
									Add expense
								</button>
							</div>
						)}
					</div>

					{expenses.map((expense) => (
						<div key={expense.id} className="p-2 sm:p-4 hover:bg-slate-900/40 transition-all group">
							<ExpenseRow
								expense={expense}
								planKind={planKind}
								month={month}
								year={year}
								payDate={payDate}
								isBusy={isBusy}
								paymentValue={paymentByExpenseId[expense.id] ?? ""}
								onPaymentValueChange={(value) => onPaymentValueChange(expense.id, value)}
								paymentSourceValue={paymentSourceByExpenseId[expense.id] ?? "income"}
								onPaymentSourceChange={(value) => onPaymentSourceChange(expense.id, value)}
								creditCards={creditCards}
								cardDebtIdValue={cardDebtIdByExpenseId[expense.id] ?? ""}
								onCardDebtIdChange={(value) => onCardDebtIdChange(expense.id, value)}
								onTogglePaid={() => onTogglePaid(expense.id)}
								onEdit={() => onEdit(expense)}
								onDelete={() => onDelete(expense)}
								onApplyPayment={() => onApplyPayment(expense.id)}
								showDueBadge
								showAllocationBadge
							/>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
