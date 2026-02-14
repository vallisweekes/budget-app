"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, X, Check, CreditCard, TrendingDown, ShoppingBag } from "lucide-react";
import DeleteDebtButton from "./DeleteDebtButton";
import { formatCurrency } from "@/lib/helpers/money";
import { updateDebtAction, makePaymentFromForm } from "@/lib/debts/actions";
import { SelectDropdown } from "@/components/Shared";
import type { DebtPayment } from "@/types";

interface Debt {
	id: string;
	name: string;
	type: string;
	initialBalance: number;
	currentBalance: number;
	amount: number;
	monthlyMinimum?: number;
	interestRate?: number;
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

	const Icon = typeIcons[debt.type as keyof typeof typeIcons];
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
		<div className={`bg-slate-800/40 backdrop-blur-xl rounded-2xl border p-6 hover:border-white/20 transition-all ${
			isNearPayday ? 'border-amber-500/50 shadow-lg shadow-amber-500/20' : 'border-white/10'
		}`}>
			{isNearPayday && (
				<div className="mb-3 flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg w-fit">
					<div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
					<span className="text-xs font-semibold text-amber-400">
						{daysUntilPayday === 0 ? 'PAYDAY - Payment Due Today' : `Payment Due in ${daysUntilPayday} day${daysUntilPayday > 1 ? 's' : ''}`}
					</span>
				</div>
			)}
			<div className="flex items-start justify-between mb-4">
				<div className="flex items-center gap-4 flex-1">
					<div className="p-3 bg-red-500/10 backdrop-blur-sm rounded-full">
						<Icon className="w-6 h-6 text-red-400" />
					</div>
					{isEditing ? (
						<div className="flex-1">
							<input
								type="text"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								className="w-full px-3 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
								placeholder="Debt name"
							/>
						</div>
					) : (
						<div>
							<h3 className="text-lg font-bold text-white">{debt.name}</h3>
							<p className="text-sm text-slate-400">{typeLabels[debt.type as keyof typeof typeLabels]}</p>
						</div>
					)}
				</div>
				<div className="flex items-center gap-2">
					{isEditing ? (
						<>
							<button
								onClick={handleSave}
								disabled={isPending}
								className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
								title="Save"
							>
								<Check size={18} />
							</button>
							<button
								onClick={handleCancel}
								disabled={isPending}
								className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
								title="Cancel"
							>
								<X size={18} />
							</button>
						</>
					) : (
						<>
							<button
								onClick={handleEdit}
								className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
								title="Edit debt"
							>
								<Pencil size={18} />
							</button>
							<DeleteDebtButton debtId={debt.id} debtName={debt.name} budgetPlanId={budgetPlanId} />
						</>
					)}
				</div>
			</div>

			{isEditing ? (
				<div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
					<div>
						<label className="block text-xs text-slate-400 mb-1">Initial Balance</label>
						<input
							type="number"
							step="0.01"
							value={editInitialBalance}
							onChange={(e) => setEditInitialBalance(e.target.value)}
							className="w-full px-3 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
							placeholder="Initial balance"
						/>
					</div>
					<div>
						<label className="block text-xs text-slate-400 mb-1">Current Balance</label>
						<input
							type="number"
							step="0.01"
							value={editCurrentBalance}
							onChange={(e) => setEditCurrentBalance(e.target.value)}
							className="w-full px-3 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
							placeholder="Current balance"
						/>
					</div>
					<div>
						<label className="block text-xs text-slate-400 mb-1">Due This Month</label>
						<input
							type="number"
							step="0.01"
							value={editDueAmount}
							onChange={(e) => setEditDueAmount(e.target.value)}
							className="w-full px-3 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
							placeholder="Payment amount"
						/>
					</div>
					<div>
						<label className="block text-xs text-slate-400 mb-1">Monthly Minimum</label>
						<input
							type="number"
							step="0.01"
							value={editMonthlyMinimum}
							onChange={(e) => setEditMonthlyMinimum(e.target.value)}
							className="w-full px-3 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
							placeholder="Optional"
						/>
					</div>
					<div>
						<label className="block text-xs text-slate-400 mb-1">Interest Rate (%)</label>
						<input
							type="number"
							step="0.01"
							value={editInterestRate}
							onChange={(e) => setEditInterestRate(e.target.value)}
							className="w-full px-3 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
							placeholder="Optional"
						/>
					</div>
				</div>
			) : (
				<>
					<div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
						<div>
							<div className="text-xs text-slate-400 mb-1">Current Balance</div>
							<div className="text-xl font-bold text-red-400">
								<Currency value={debt.currentBalance} />
							</div>
						</div>
						<div>
							<div className="text-xs text-slate-400 mb-1">Initial Balance</div>
							<div className="text-lg font-semibold text-slate-300">
								<Currency value={debt.initialBalance} />
							</div>
						</div>
						<div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
							<div className="text-xs text-amber-300 mb-1 font-medium flex items-center justify-between">
								<span>Due This Month</span>
								{!isEditingAmount ? (
									<button
										onClick={() => {
											setTempDueAmount(String(debt.amount));
											setIsEditingAmount(true);
										}}
										className="p-1 rounded hover:bg-amber-500/20 transition-colors"
										title="Edit amount"
									>
										<Pencil size={12} className="text-amber-300" />
									</button>
								) : null}
							</div>
							{isEditingAmount ? (
								<div className="flex items-center gap-2">
									<input
										type="number"
										step="0.01"
										value={tempDueAmount}
										onChange={(e) => setTempDueAmount(e.target.value)}
										className="flex-1 px-2 py-1 bg-slate-900/60 border border-amber-500/30 text-amber-400 rounded text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
										autoFocus
									/>
									<button
										onClick={handleSaveDueAmount}
										disabled={isPending}
										className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
										title="Save"
									>
										<Check size={14} />
									</button>
									<button
										onClick={() => setIsEditingAmount(false)}
										disabled={isPending}
										className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
										title="Cancel"
									>
										<X size={14} />
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
								<div className="text-xs text-slate-400 mb-1">Monthly Minimum</div>
								<div className="text-lg font-semibold text-slate-300">
									<Currency value={debt.monthlyMinimum} />
								</div>
							</div>
						)}
						{debt.interestRate && (
							<div>
								<div className="text-xs text-slate-400 mb-1">Interest Rate</div>
								<div className="text-lg font-semibold text-slate-300">
									{debt.interestRate}%
								</div>
							</div>
						)}
					</div>

					{/* Progress Bar */}
					<div className="mb-4">
						<div className="flex justify-between text-xs text-slate-400 mb-1">
							<span>Progress</span>
							<span>{percentPaid.toFixed(1)}% paid</span>
						</div>
						<div className="w-full bg-white/10 rounded-full h-2">
							<div
								className="bg-gradient-to-r from-emerald-400 to-green-500 h-2 rounded-full transition-all"
								style={{ width: `${Math.min(100, percentPaid)}%` }}
							/>
						</div>
					</div>

					{/* Make Payment Form */}
					<div className="bg-slate-900/40 rounded-xl p-4 border border-white/5">
						<h4 className="text-sm font-semibold text-slate-300 mb-3">Record Payment</h4>
						<form key={debt.amount} action={makePaymentFromForm} className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-3 sm:items-end">
							<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
							<input type="hidden" name="debtId" value={debt.id} />
							<input type="hidden" name="month" value={paymentMonth} />
							<input type="hidden" name="source" value={paymentSource} />
							<div>
								<label className="block text-xs font-medium text-slate-300 mb-1.5">Payment Amount</label>
								<input
									type="number"
									name="amount"
									step="0.01"
									placeholder="Amount"
									defaultValue={debt.amount}
									required
									aria-label="Payment amount"
									className="h-10 w-full px-3 py-2 bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
								/>
							</div>
							<div>
								<label className="block text-xs font-medium text-slate-300 mb-1.5">Source</label>
								<SelectDropdown
									options={[
										{ value: "income", label: "Income (tracked)" },
										{ value: "extra_funds", label: "Extra funds" },
									]}
									value={paymentSource}
									onValueChange={setPaymentSource}
									variant="dark"
									buttonClassName="h-10"
								/>
							</div>
							<button
								type="submit"
								className="h-10 px-6 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-lg hover:shadow-xl cursor-pointer whitespace-nowrap"
							>
								Make Payment
							</button>
						</form>
						<p className="text-xs text-slate-500 mt-3">
							💡 <span className="text-amber-400">Income (tracked)</span> payments reduce your available budget for the month.{" "}
							<span className="text-blue-400">Extra funds</span> don't affect your monthly budget.
						</p>
					</div>

					{payments.length > 0 && (
						<div className="mt-4 pt-4 border-t border-white/10">
							<div className="text-xs text-slate-400 mb-2">Recent Payments</div>
							<div className="space-y-1">
								{payments.slice(-3).reverse().map((payment) => (
									<div key={payment.id} className="flex items-center justify-between gap-3 text-sm">
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
				</>
			)}
		</div>
	);
}
