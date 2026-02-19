"use client";

import { Check, Pencil, Trash2 } from "lucide-react";
import type { ExpenseItem, MonthKey } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";
import { formatIsoDueDate, getDueDateUtc, daysUntilUtc, dueBadgeClasses } from "@/lib/helpers/expenses/dueDate";
import { MONTHS } from "@/lib/constants/time";
import { SelectDropdown } from "@/components/Shared";
import type { CreditCardOption } from "@/types/expenses-manager";

type Props = {
	expense: ExpenseItem;
	planKind: string;
	month: MonthKey;
	year: number;
	payDate: number;
	isBusy?: boolean;
	paymentValue: string;
	onPaymentValueChange: (value: string) => void;
	paymentSourceValue: string;
	onPaymentSourceChange: (value: string) => void;
	creditCards?: CreditCardOption[];
	cardDebtIdValue?: string;
	onCardDebtIdChange?: (value: string) => void;
	onTogglePaid: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onApplyPayment: () => void;
	showDueBadge?: boolean;
	showAllocationBadge?: boolean;
	showPartialPaidBadge?: boolean;
};

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function ExpenseRow({
	expense,
	planKind,
	month,
	year,
	payDate,
	isBusy,
	paymentValue,
	onPaymentValueChange,
	paymentSourceValue,
	onPaymentSourceChange,
	creditCards,
	cardDebtIdValue,
	onCardDebtIdChange,
	onTogglePaid,
	onEdit,
	onDelete,
	onApplyPayment,
	showDueBadge = false,
	showAllocationBadge = false,
	showPartialPaidBadge = false,
}: Props) {
	const isPaid = !!expense.paid;
	const paidAmount = isPaid ? expense.amount : (expense.paidAmount ?? 0);
	const remaining = Math.max(0, expense.amount - paidAmount);
	const cards = creditCards ?? [];
	const isCreditCard = paymentSourceValue === "credit_card";
	const cardRequired = isCreditCard && cards.length > 1;
	const hasSelectedCard = Boolean((cardDebtIdValue ?? "").trim());
	const disableMarkPaid =
		!isPaid &&
		isCreditCard &&
		(cards.length === 0 || (cardRequired && !hasSelectedCard));

	return (
		<div className="space-y-2 sm:space-y-3">
			<div className="flex items-start justify-between gap-2 sm:gap-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5 mb-0.5 sm:mb-1 flex-wrap">
						<div className="font-semibold text-white text-xs sm:text-sm truncate">{expense.name}</div>
						{showAllocationBadge && expense.isAllocation ? (
							<span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-lg font-semibold shrink-0 bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
								Allocation
							</span>
						) : null}
						{showDueBadge ? (
							(() => {
								const monthNumber = (MONTHS as MonthKey[]).indexOf(month) + 1;
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
										Due: {expense.dueDate ? formatIsoDueDate(expense.dueDate) : `Day ${payDate}`}
									</span>
								);
							})()
						) : null}
					</div>

					<div className="flex items-center gap-2 text-xs sm:text-sm">
						<span className="text-slate-300 font-medium">
							<Currency value={expense.amount} />
						</span>
						{showPartialPaidBadge && expense.paidAmount && expense.paidAmount > 0 && expense.paidAmount < expense.amount ? (
							<span className="text-amber-400 text-xs bg-amber-500/10 px-2 py-1 rounded-lg">
								Paid: <Currency value={expense.paidAmount} />
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

			<div className="flex flex-col gap-1.5 sm:gap-2">
				<div className="w-full">
					<div className="text-[10px] sm:text-xs text-slate-400">
						Paid <span className="text-slate-200 font-medium"><Currency value={paidAmount} /></span> · Remaining{" "}
						<span className="text-slate-200 font-medium"><Currency value={remaining} /></span>
					</div>
					<div className="mt-1.5 h-1.5 sm:h-2 w-full rounded-full bg-slate-900/40 border border-white/10 overflow-hidden">
						<div
							className={`h-full ${remaining === 0 ? "bg-emerald-500/70" : "bg-purple-500/70"}`}
							style={{ width: `${Math.min(100, (paidAmount / Math.max(1, expense.amount)) * 100)}%` }}
						/>
					</div>
				</div>

				{remaining > 0 ? (
					<div className="w-full">
						<label className="block">
							<span className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1">Payment amount (£)</span>
							<div className="flex items-center gap-1.5 sm:gap-2">
								<input
									type="number"
									step="0.01"
									min={0}
									value={paymentValue}
									onChange={(e) => onPaymentValueChange(e.target.value)}
									className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-white/10 bg-slate-900/40 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all"
									placeholder="0.00"
								/>

								<SelectDropdown
									value={paymentSourceValue}
									onValueChange={onPaymentSourceChange}
									options={[
										{ value: "income", label: "Income" },
										{ value: "credit_card", label: "Credit Card" },
										{ value: "savings", label: "Savings" },
										{ value: "other", label: "Other" },
									]}
									buttonClassName="focus:ring-purple-500/50"
									className="min-w-[140px]"
								/>

								{isCreditCard ? (
									cards.length > 0 ? (
										<SelectDropdown
											value={cardDebtIdValue ?? ""}
											onValueChange={(v) => onCardDebtIdChange?.(v)}
											required={cardRequired}
											placeholder={cards.length === 1 ? "Card" : "Choose card"}
											options={cards.map((c) => ({ value: c.id, label: c.name }))}
											buttonClassName="focus:ring-purple-500/50"
											className="min-w-[160px]"
										/>
									) : (
										<div className="min-w-[160px] rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[10px] sm:text-xs text-amber-100">
											No cards
										</div>
									)
								) : null}

								<button
									type="button"
									onClick={onApplyPayment}
									disabled={
									isBusy ||
									(isCreditCard && (cards.length === 0 || (cardRequired && !hasSelectedCard)))
								}
									className="shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-purple-500/20 text-purple-200 border border-purple-400/30 hover:bg-purple-500/30 transition-all cursor-pointer disabled:opacity-50 text-[10px] sm:text-xs whitespace-nowrap"
								>
									Add payment
								</button>
							</div>
						</label>
						{isCreditCard && cards.length === 0 ? (
							<p className="mt-1 text-[10px] sm:text-xs text-amber-200/90">Add a credit card in Debts to use this source.</p>
						) : isCreditCard && cardRequired && !hasSelectedCard ? (
							<p className="mt-1 text-[10px] sm:text-xs text-amber-200/90">Select a card to continue.</p>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
