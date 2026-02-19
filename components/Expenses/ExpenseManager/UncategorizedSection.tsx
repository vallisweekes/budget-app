"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { MonthKey, ExpenseItem } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";
import type { CreditCardOption, DebtOption } from "@/types/expenses-manager";
import ExpenseRow from "@/components/Expenses/ExpenseManager/ExpenseRow";

type Props = {
	expenses: ExpenseItem[];
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

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/10 hover:shadow-2xl transition-all">
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
						<div className="text-slate-400">
							{isCollapsed ? <ChevronDown size={20} className="sm:w-6 sm:h-6" /> : <ChevronUp size={20} className="sm:w-6 sm:h-6" />}
						</div>
					</div>
				</div>
			</button>

			{!isCollapsed ? (
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
								showDueBadge={false}
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
