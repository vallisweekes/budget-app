"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, X, Check, CreditCard, TrendingDown, ShoppingBag } from "lucide-react";
import DeleteDebtButton from "./DeleteDebtButton";
import { formatCurrency } from "@/lib/helpers/money";
import { updateDebtAction, makePaymentFromForm } from "@/lib/debts/actions";
import { SelectDropdown } from "@/components/Shared";
import type { DebtPayment, DebtType } from "@/types";
import { getDebtMonthlyPayment } from "@/lib/debts/calculate";

interface Debt {
	id: string;
	name: string;
	type: DebtType;
	initialBalance: number;
	currentBalance: number;
	amount: number;
	paid: boolean;
	paidAmount: number;
	monthlyMinimum?: number;
	interestRate?: number;
	installmentMonths?: number;
	createdAt: string;
	sourceType?: "expense";
	sourceExpenseId?: string;
	sourceMonthKey?: string;
	sourceCategoryName?: string;
	sourceExpenseName?: string;
}

interface DebtCardProps {
	debt: Debt;
	budgetPlanId: string;
	typeLabels: Record<string, string>;
	payments: DebtPayment[];
	payDate: number;
}

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

const typeIcons = {
	credit_card: CreditCard,
	loan: TrendingDown,
	high_purchase: ShoppingBag,
} as const;

export default function DebtCard({ debt, budgetPlanId, typeLabels, payments, payDate }: DebtCardProps) {
	// Check if it's near payday (within 3 days before or on payday)
	const now = new Date();
	const currentDay = now.getDate();
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	const daysUntilPayday = payDate >= currentDay 
		? payDate - currentDay 
		: (daysInMonth - currentDay) + payDate;
	const isNearPayday = daysUntilPayday <= 3 && debt.amount > 0;

	const [isPending, startTransition] = useTransition();
	const [isCollapsed, setIsCollapsed] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const [isEditingAmount, setIsEditingAmount] = useState(false);
	const [paymentSource, setPaymentSource] = useState("income");
	const [editName, setEditName] = useState(debt.name);
	const [editInitialBalance, setEditInitialBalance] = useState(String(debt.initialBalance));
	const [editCurrentBalance, setEditCurrentBalance] = useState(String(debt.currentBalance));
	const [editDueAmount, setEditDueAmount] = useState(String(debt.amount));
	const [tempDueAmount, setTempDueAmount] = useState(String(debt.amount));
	const [editMonthlyMinimum, setEditMonthlyMinimum] = useState(debt.monthlyMinimum ? String(debt.monthlyMinimum) : "");
	const [editInterestRate, setEditInterestRate] = useState(debt.interestRate ? String(debt.interestRate) : "");
	const [editInstallmentMonths, setEditInstallmentMonths] = useState(debt.installmentMonths ? String(debt.installmentMonths) : "");

	const Icon = typeIcons[debt.type as keyof typeof typeIcons];
	
	// Calculate effective monthly payment considering installment plan and minimum
	const effectiveMonthlyPayment = getDebtMonthlyPayment(debt);
	
	const percentPaid = debt.initialBalance > 0
		? ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100
		: 0;

	const paymentMonth = useMemo(() => {
		const now = new Date();
		const y = now.getUTCFullYear();
		const m = String(now.getUTCMonth() + 1).padStart(2, "0");
		return `${y}-${m}`;
	}, []);

	const handleEdit = () => {
		setEditName(debt.name);
		setEditInitialBalance(String(debt.initialBalance));
		setEditCurrentBalance(String(debt.currentBalance));
		setEditDueAmount(String(debt.amount));
		setEditMonthlyMinimum(debt.monthlyMinimum ? String(debt.monthlyMinimum) : "");
		setEditInterestRate(debt.interestRate ? String(debt.interestRate) : "");
		setEditInstallmentMonths(debt.installmentMonths ? String(debt.installmentMonths) : "");
		setIsEditingAmount(false);
		setIsCollapsed(false);
		setIsEditing(true);
	};

	const handleCancel = () => {
		setIsEditing(false);
	};

	const handleSave = async () => {
		const formData = new FormData();
		formData.append("budgetPlanId", budgetPlanId);
		formData.append("name", editName);
		formData.append("initialBalance", editInitialBalance);
		formData.append("currentBalance", editCurrentBalance);
		formData.append("amount", editDueAmount);
		if (editMonthlyMinimum) formData.append("monthlyMinimum", editMonthlyMinimum);
		if (editInterestRate) formData.append("interestRate", editInterestRate);
		if (editInstallmentMonths) formData.append("installmentMonths", editInstallmentMonths);

		startTransition(async () => {
			await updateDebtAction(debt.id, formData);
			setIsEditing(false);
		});
	};

	const handleSaveDueAmount = async () => {
		const formData = new FormData();
		formData.append("budgetPlanId", budgetPlanId);
		formData.append("name", debt.name);
		formData.append("initialBalance", String(debt.initialBalance));
		formData.append("currentBalance", String(debt.currentBalance));
		formData.append("amount", tempDueAmount);
		if (debt.monthlyMinimum) formData.append("monthlyMinimum", String(debt.monthlyMinimum));
		if (debt.interestRate) formData.append("interestRate", String(debt.interestRate));

		startTransition(async () => {
			await updateDebtAction(debt.id, formData);
			setIsEditingAmount(false);
		});
	};

	return (
		<div className={`bg-slate-800/40 backdrop-blur-xl rounded-xl sm:rounded-2xl border p-3 sm:p-5 hover:border-white/20 transition-all ${
			isNearPayday ? 'border-amber-500/50 shadow-lg shadow-amber-500/20' : 'border-white/10'
		}`}>
			{isNearPayday && (
				<div className="mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg w-fit">
					<div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-500 rounded-full animate-pulse" />
					<span className="text-[10px] sm:text-xs font-semibold text-amber-400">
						{daysUntilPayday === 0 ? 'PAYDAY - Payment Due Today' : `Payment Due in ${daysUntilPayday} day${daysUntilPayday > 1 ? 's' : ''}`}
					</span>
				</div>
			)}
			<div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
				<button
					onClick={() => !isEditing && setIsCollapsed(!isCollapsed)}
					type="button"
					className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left cursor-pointer"
				>
					<div className="p-2 sm:p-2.5 bg-red-500/10 backdrop-blur-sm rounded-full shrink-0">
						<Icon className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
					</div>
					{isEditing ? (
						<div className="flex-1 min-w-0">
							<input
								type="text"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
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
									? `${debt.sourceCategoryName || ''} → ${debt.sourceExpenseName}${debt.sourceMonthKey ? ` (${debt.sourceMonthKey})` : ''}`
									: typeLabels[debt.type as keyof typeof typeLabels]}
							</p>
						</div>
					)}
				</button>
				<div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
					{isEditing ? (
						<>
							<button
								onClick={handleSave}
								disabled={isPending}
								className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
								title="Save"
							>
								<Check size={14} className="sm:w-[18px] sm:h-[18px]" />
							</button>
							<button
								onClick={handleCancel}
								disabled={isPending}
								className="p-1.5 sm:p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
								title="Cancel"
							>
								<X size={14} className="sm:w-[18px] sm:h-[18px]" />
							</button>
						</>
					) : (
						<>
							<button
								onClick={handleEdit}
								className="p-1.5 sm:p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
								title="Edit debt"
							>
								<Pencil size={14} className="sm:w-[18px] sm:h-[18px]" />
							</button>
							<DeleteDebtButton debtId={debt.id} debtName={debt.name} budgetPlanId={budgetPlanId} />
						</>
					)}
				</div>
			</div>

			{/* Collapsed Summary View */}
			{isCollapsed && !isEditing && (
				<div className="grid grid-cols-2 gap-2 sm:gap-3">
					<div>
						<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5">Current</div>
						<div className="text-sm sm:text-base font-bold text-red-400">
							<Currency value={debt.currentBalance} />
						</div>
					</div>
					<div className="bg-amber-500/10 rounded-lg p-2 border border-amber-500/20">
						<div className="text-[10px] sm:text-xs text-amber-300 mb-0.5">Due This Month</div>
						<div className="text-sm sm:text-base font-bold text-amber-400">
							<Currency value={debt.amount} />
						</div>
					</div>
					<div className="col-span-2">
						<div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-400 mb-0.5">
							<span>Progress</span>
							<span>{percentPaid.toFixed(0)}% paid</span>
						</div>
						<div className="w-full bg-white/10 rounded-full h-1.5">
							<div
								className="bg-gradient-to-r from-emerald-400 to-green-500 h-1.5 rounded-full transition-all"
								style={{ width: `${Math.min(100, percentPaid)}%` }}
							/>
						</div>
					</div>
				</div>
			)}

			{/* Expanded Details View */}
			{!isCollapsed && (
			<>
			{isEditing ? (
				<>
				<div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-4 mb-3 sm:mb-4">
					<div>
						<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Initial Balance</label>
						<input
							type="number"
							step="0.01"
							value={editInitialBalance}
							onChange={(e) => setEditInitialBalance(e.target.value)}
							className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
							placeholder="Initial balance"
						/>
					</div>
					<div>
						<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Current Balance</label>
						<input
							type="number"
							step="0.01"
							value={editCurrentBalance}
							onChange={(e) => setEditCurrentBalance(e.target.value)}
							className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
							placeholder="Current balance"
						/>
					</div>
					<div>
						<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Due This Month</label>
						<input
							type="number"
							step="0.01"
							value={editDueAmount}
							onChange={(e) => setEditDueAmount(e.target.value)}
							className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
							placeholder="Payment amount"
						/>
					</div>
					<div>
						<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Monthly Minimum</label>
						<input
							type="number"
							step="0.01"
							value={editMonthlyMinimum}
							onChange={(e) => setEditMonthlyMinimum(e.target.value)}
							className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
							placeholder="Optional"
						/>
					</div>
					<div>
						<label className="block text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Interest Rate (%)</label>
						<input
							type="number"
							step="0.01"
							value={editInterestRate}
							onChange={(e) => setEditInterestRate(e.target.value)}
							className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
							placeholder="Optional"
						/>
					</div>
				</div>
				<div className="mb-3 sm:mb-4">
					<label className="block text-[10px] sm:text-xs text-slate-400 mb-1.5 sm:mb-2">Installment Plan (spread cost over time)</label>
					<div className="flex flex-wrap gap-1.5 sm:gap-2">
						{[0, 2, 3, 4, 6, 8, 9, 12, 18, 24, 30, 36].map((months) => (
							<button
								key={months}
								type="button"
								onClick={() => {
									setEditInstallmentMonths(months === 0 ? "" : String(months));
									// Auto-calculate monthly amount if installment is set
									if (months > 0 && parseFloat(editCurrentBalance) > 0) {
										const monthlyAmount = parseFloat(editCurrentBalance) / months;
										const min = editMonthlyMinimum ? parseFloat(editMonthlyMinimum) : 0;
										const effective = Math.max(monthlyAmount, Number.isFinite(min) ? min : 0);
										setEditDueAmount(effective.toFixed(2));
									}
								}}
								className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-all ${
									(months === 0 && !editInstallmentMonths) || editInstallmentMonths === String(months)
										? "bg-purple-500 text-white"
										: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40 border border-white/10"
								}`}
							>
								{months === 0 ? "None" : `${months} months`}
							</button>
						))}
					</div>
					{editInstallmentMonths && parseFloat(editCurrentBalance) > 0 && (
						<div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
							<div className="text-xs sm:text-sm text-purple-300">
								Installment: <span className="font-bold">
									<Currency value={parseFloat(editCurrentBalance) / parseFloat(editInstallmentMonths)} />
								</span> per month for {editInstallmentMonths} months
								<div className="text-xs text-slate-400 mt-1">
									💡 &quot;Due This Month&quot; will be auto-calculated based on this plan
								</div>
								{editMonthlyMinimum && parseFloat(editMonthlyMinimum) > (parseFloat(editCurrentBalance) / parseFloat(editInstallmentMonths)) && (
									<div className="text-xs text-amber-400 mt-2 flex items-start gap-1">
										<span>⚠️</span>
										<span>Monthly minimum (£{parseFloat(editMonthlyMinimum).toFixed(2)}) is higher than installment. The higher amount will be used.</span>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
				</>
			) : (
				<>
					<div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-4 mb-3 sm:mb-4">
						<div>
							<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Current Balance</div>
							<div className="text-lg sm:text-xl font-bold text-red-400">
								<Currency value={debt.currentBalance} />
							</div>
						</div>
						<div>
							<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Initial Balance</div>
							<div className="text-base sm:text-lg font-semibold text-slate-300">
								<Currency value={debt.initialBalance} />
							</div>
						</div>
						<div className="bg-amber-500/10 rounded-lg p-2 sm:p-3 border border-amber-500/20">
							<div className="text-[10px] sm:text-xs text-amber-300 mb-0.5 sm:mb-1 font-medium flex items-center justify-between">
								<span>Due This Month</span>
								{!isEditingAmount ? (
									<button
										onClick={() => {
											setTempDueAmount(String(debt.amount));
											setIsEditingAmount(true);
										}}
										className="p-0.5 sm:p-1 rounded hover:bg-amber-500/20 transition-colors"
										title="Edit amount"
									>
										<Pencil size={10} className="sm:w-3 sm:h-3 text-amber-300" />
									</button>
									) : null}
								</div>
								{isEditingAmount ? (
									<div className="flex items-center gap-2.5 sm:gap-3">
										<input
											type="number"
											step="0.01"
											value={tempDueAmount}
											onChange={(e) => setTempDueAmount(e.target.value)}
											className="flex-1 min-w-0 px-2 py-1 sm:px-3 sm:py-1 bg-slate-900/60 border border-amber-500/30 text-amber-400 rounded text-base sm:text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
										autoFocus
									/>
									<button
										onClick={handleSaveDueAmount}
										disabled={isPending}
											className="p-0.5 sm:p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
											title="Save"
										>
											<Check size={12} className="sm:w-[14px] sm:h-[14px]" />
										</button>
										<button
											onClick={() => setIsEditingAmount(false)}
											disabled={isPending}
											className="p-0.5 sm:p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
											title="Cancel"
										>
											<X size={12} className="sm:w-[14px] sm:h-[14px]" />
									</button>
								</div>
							) : (
								<div className="text-xl font-bold text-amber-400">
									<Currency value={debt.amount} />
								</div>
							)}
						</div>
						{debt.monthlyMinimum && (
							<div>
									<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Monthly Minimum</div>
									<div className="text-base sm:text-lg font-semibold text-slate-300">
										<Currency value={debt.monthlyMinimum} />
									</div>
								</div>
							)}
							{debt.interestRate && (
								<div>
									<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Interest Rate</div>
									<div className="text-base sm:text-lg font-semibold text-slate-300">
									{debt.interestRate}%
								</div>
							</div>
						)}
					</div>

					{/* Installment Plan Display */}
					{debt.installmentMonths && debt.currentBalance > 0 && (
						<div className="mb-3 sm:mb-4 p-2.5 sm:p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
							<div className="flex items-center justify-between">
								<div>
									<div className="text-[10px] sm:text-xs text-purple-300 mb-0.5 sm:mb-1">Installment Plan Active</div>
									<div className="text-base sm:text-lg font-bold text-purple-400">
										<Currency value={effectiveMonthlyPayment} /> / month
									</div>
									<div className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
										for {debt.installmentMonths} months
										{debt.monthlyMinimum && effectiveMonthlyPayment > (debt.currentBalance / debt.installmentMonths) && (
											<span className="block text-amber-400 mt-1">
												⚠️ Monthly minimum (£{debt.monthlyMinimum.toFixed(2)}) applied
											</span>
										)}
									</div>
								</div>
								<div className="text-right">
									<div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Remaining</div>
									<div className="text-xs sm:text-sm font-semibold text-slate-300">
										<Currency value={debt.currentBalance} />
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Make Payment Form */}
					<div className="bg-slate-900/40 rounded-xl p-2.5 sm:p-4 border border-white/5">
						<h4 className="text-xs sm:text-sm font-semibold text-slate-300 mb-2 sm:mb-3">Record Payment</h4>
						<form key={debt.amount} action={makePaymentFromForm} className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 sm:gap-3 sm:items-end">
							<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
							<input type="hidden" name="debtId" value={debt.id} />
							<input type="hidden" name="month" value={paymentMonth} />
							<input type="hidden" name="source" value={paymentSource} />
							<div>
								<label className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1 sm:mb-1.5">Payment Amount</label>
								<input
									type="number"
									name="amount"
									step="0.01"
									placeholder="Amount"
									defaultValue={debt.amount}
									required
									aria-label="Payment amount"
									className="h-8 sm:h-10 w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs sm:text-sm"
								/>
							</div>
							<div>
								<label className="block text-[10px] sm:text-xs font-medium text-slate-300 mb-1 sm:mb-1.5">Source</label>
								<SelectDropdown
									options={[
										{ value: "income", label: "Income (tracked)" },
										{ value: "extra_funds", label: "Extra funds" },
									]}
									value={paymentSource}
									onValueChange={setPaymentSource}
									variant="dark"
									buttonClassName="h-8 sm:h-10 text-xs sm:text-sm"
								/>
							</div>
							<button
								type="submit"
								className="h-8 sm:h-10 px-3 sm:px-6 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-lg hover:shadow-xl cursor-pointer whitespace-nowrap text-xs sm:text-sm"
							>
								Make Payment
							</button>
						</form>
						<p className="text-[10px] sm:text-xs text-slate-500 mt-2 sm:mt-3">
							💡 <span className="text-amber-400">Income (tracked)</span> payments reduce your available budget for the month.{" "}
							<span className="text-blue-400">Extra funds</span> don&apos;t affect your monthly budget.
						</p>
					</div>

					{payments.length > 0 && (
						<div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
							<div className="text-[10px] sm:text-xs text-slate-400 mb-1.5 sm:mb-2">Recent Payments</div>
							<div className="space-y-0.5 sm:space-y-1">
								{payments.slice(-3).reverse().map((payment) => (
									<div key={payment.id} className="flex items-center justify-between gap-2 sm:gap-3 text-xs sm:text-sm">
										<span className="text-slate-400">
											{new Date(payment.date).toLocaleDateString()}
											{payment.source ? (
												<span className="ml-2 text-xs text-slate-500">
													({payment.source === "extra_funds" ? "extra funds" : "income"})
												</span>
											) : null}
										</span>
										<span className="font-semibold text-emerald-400 whitespace-nowrap">
											-<Currency value={payment.amount} />
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Progress Bar (keep at bottom when expanded) */}
					<div className="mt-3 sm:mt-4">
						<div className="flex justify-between text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">
							<span>Progress</span>
							<span>{percentPaid.toFixed(1)}% paid</span>
						</div>
						<div className="w-full bg-white/10 rounded-full h-1.5 sm:h-2">
							<div
								className="bg-gradient-to-r from-emerald-400 to-green-500 h-1.5 sm:h-2 rounded-full transition-all"
								style={{ width: `${Math.min(100, percentPaid)}%` }}
							/>
						</div>
					</div>
				</>
			)}
			</>
			)}
		</div>
	);
}
