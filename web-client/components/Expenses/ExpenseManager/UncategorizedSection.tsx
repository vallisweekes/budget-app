"use client";

import type { MonthKey, ExpenseItem } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";
import { MONTHS } from "@/lib/constants/time";
import { getDueDateUtc, daysUntilUtc, formatDueDateLabel } from "@/lib/helpers/expenses/dueDate";
import type { CreditCardOption, DebtOption } from "@/types/expenses-manager";
import ExpenseRow from "@/components/Expenses/ExpenseManager/ExpenseRow";

type Props = {
	expenses: ExpenseItem[];
	variant?: "full" | "preview";
	onView?: () => void;
	planKind: string;
	month: MonthKey;
	year: number;
	payDate: number;
	isBusy?: boolean;
	isCollapsed: boolean;
	onToggleCollapsed: () => void;
	paymentByExpenseId: Record<string, string>;
	onPaymentValueChange: (expenseId: string, value: string) => void;
	paymentSourceByExpenseId: Record<string, string>;
	onPaymentSourceChange: (expenseId: string, value: string) => void;
	creditCards?: CreditCardOption[];
	cardDebtIdByExpenseId: Record<string, string>;
	onCardDebtIdChange: (expenseId: string, value: string) => void;
	debts?: DebtOption[];
	debtIdByExpenseId: Record<string, string>;
	onDebtIdChange: (expenseId: string, value: string) => void;
	onTogglePaid: (expenseId: string) => void;
	onEdit: (expense: ExpenseItem) => void;
	onDelete: (expense: ExpenseItem) => void;
	onApplyPayment: (expenseId: string) => void;
};

export default function UncategorizedSection({
	expenses,
	variant = "full",
	onView,
	planKind,
	month,
	year,
	payDate,
	isBusy,
	isCollapsed,
	onToggleCollapsed,
	paymentByExpenseId,
	onPaymentValueChange,
	paymentSourceByExpenseId,
	onPaymentSourceChange,
	creditCards,
	cardDebtIdByExpenseId,
	onCardDebtIdChange,
	debts,
	debtIdByExpenseId,
	onDebtIdChange,
	onTogglePaid,
	onEdit,
	onDelete,
	onApplyPayment,
}: Props) {
	if (expenses.length === 0) return null;

	const total = expenses.reduce((sum, e) => sum + e.amount, 0);
	const paidCount = expenses.filter((e) => e.paid).length;
	const previewLimit = 3;
	const previewExpenses = expenses.slice(0, previewLimit);

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/10 hover:shadow-2xl transition-all">
			{variant === "preview" ? (
				<div className="w-full p-3 sm:p-4 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40">
					<div className="flex items-center justify-between gap-2 sm:gap-3">
						<div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
							<div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-600 rounded-xl sm:rounded-2xl shadow-lg shrink-0">
								<span className="text-lg sm:text-xl">📋</span>
							</div>
							<div className="text-left min-w-0 flex-1">
								<h3 className="font-bold text-sm sm:text-base text-white truncate">Miscellaneous</h3>
								<p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
									{expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 sm:gap-3 shrink-0">
							<div className="text-right">
								<div className="text-base sm:text-xl font-bold text-white">{formatCurrency(total)}</div>
								<div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{paidCount} paid</div>
							</div>
							<button
								type="button"
								onClick={onView}
								disabled={!onView}
								className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 bg-white/5 hover:bg-white/10 transition disabled:opacity-60"
							>
								Manage
							</button>
						</div>
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={onToggleCollapsed}
					className="w-full p-3 sm:p-4 border-b border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40 hover:from-slate-900/80 hover:to-slate-900/60 transition-all cursor-pointer"
				>
					<div className="flex items-center justify-between gap-2 sm:gap-3">
						<div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
							<div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-600 rounded-xl sm:rounded-2xl shadow-lg shrink-0">
								<span className="text-lg sm:text-xl">📋</span>
							</div>
							<div className="text-left min-w-0 flex-1">
								<h3 className="font-bold text-sm sm:text-base text-white truncate">Miscellaneous</h3>
								<p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
									{expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 sm:gap-3 shrink-0">
							<div className="text-base sm:text-xl font-bold text-white">{formatCurrency(total)}</div>
						</div>
					</div>
				</button>
			)}

			{variant === "preview" ? (
				<div className="divide-y divide-white/10">
					{previewExpenses.map((expense) => (
						<div key={expense.id} className="px-3 py-2 sm:px-4 sm:py-2.5 hover:bg-slate-900/35 transition">
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0 flex-1">
									<div className="text-sm font-semibold text-slate-100 truncate">{expense.name}</div>
									{(() => {
										const monthNumber = (MONTHS as MonthKey[]).indexOf(month) + 1;
										const dueDateUtc = getDueDateUtc({ year, monthNumber, dueDate: expense.dueDate, payDate });
										const days = daysUntilUtc(dueDateUtc);
										const label = formatDueDateLabel(days, dueDateUtc);
										const colorClass = expense.paid ? "text-emerald-400" : days <= 0 ? "text-red-300" : days <= 5 ? "text-orange-300" : "text-slate-400";
										return (
											<div className={`text-[10px] sm:text-xs font-medium mt-0.5 ${colorClass}`}>
												{expense.paid ? "Paid" : label}
											</div>
										);
									})()}
								</div>
								<div className="shrink-0 text-sm font-bold text-white">{formatCurrency(expense.amount)}</div>
							</div>
						</div>
					))}
					{expenses.length > previewLimit ? (
						<div className="px-3 py-2 sm:px-4 sm:py-3 bg-slate-900/15">
							<button
								type="button"
								onClick={onView}
								disabled={!onView}
								className="text-xs font-semibold text-slate-200 hover:text-white transition disabled:opacity-60"
							>
								Manage all {expenses.length} expenses
							</button>
						</div>
					) : null}
				</div>
			) : !isCollapsed ? (
				<div className="divide-y divide-white/10">
					{expenses.map((expense) => (
						<div key={expense.id} className="p-3 sm:p-4 hover:bg-slate-900/40 transition-all group">
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
								debts={debts}
								debtIdValue={debtIdByExpenseId[expense.id] ?? ""}
								onDebtIdChange={(value) => onDebtIdChange(expense.id, value)}
								onTogglePaid={() => onTogglePaid(expense.id)}
								onEdit={() => onEdit(expense)}
								onDelete={() => onDelete(expense)}
								onApplyPayment={() => onApplyPayment(expense.id)}
								showDueBadge
								showAllocationBadge={false}
								showPartialPaidBadge
							/>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
