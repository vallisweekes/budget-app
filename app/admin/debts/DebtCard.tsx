"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Check, CreditCard, TrendingDown, ShoppingBag } from "lucide-react";
import DeleteDebtButton from "./DeleteDebtButton";
import { formatCurrency } from "@/lib/helpers/money";
import { updateDebtAction, makePaymentFromForm } from "@/lib/debts/actions";
import type { DebtPayment } from "@/types";

interface Debt {
	id: string;
	name: string;
	type: string;
	initialBalance: number;
	currentBalance: number;
	monthlyMinimum?: number;
	interestRate?: number;
}

interface DebtCardProps {
	debt: Debt;
	budgetPlanId: string;
	typeLabels: Record<string, string>;
	payments: DebtPayment[];
}

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

const typeIcons = {
	credit_card: CreditCard,
	loan: TrendingDown,
	high_purchase: ShoppingBag,
} as const;

export default function DebtCard({ debt, budgetPlanId, typeLabels, payments }: DebtCardProps) {
	const [isPending, startTransition] = useTransition();
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(debt.name);
	const [editCurrentBalance, setEditCurrentBalance] = useState(String(debt.currentBalance));
	const [editMonthlyMinimum, setEditMonthlyMinimum] = useState(debt.monthlyMinimum ? String(debt.monthlyMinimum) : "");
	const [editInterestRate, setEditInterestRate] = useState(debt.interestRate ? String(debt.interestRate) : "");

	const Icon = typeIcons[debt.type as keyof typeof typeIcons];
	const percentPaid = debt.initialBalance > 0
		? ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100
		: 0;

	const handleEdit = () => {
		setEditName(debt.name);
		setEditCurrentBalance(String(debt.currentBalance));
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
		formData.append("currentBalance", editCurrentBalance);
		if (editMonthlyMinimum) formData.append("monthlyMinimum", editMonthlyMinimum);
		if (editInterestRate) formData.append("interestRate", editInterestRate);

		startTransition(async () => {
			await updateDebtAction(debt.id, formData);
			setIsEditing(false);
		});
	};

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all">
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
				<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
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
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
					<form action={makePaymentFromForm} className="flex items-end gap-2">
						<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
						<input type="hidden" name="debtId" value={debt.id} />
						<input type="hidden" name="month" value="2026-02" />
						<label className="flex-1">
							<span className="block text-xs font-medium text-slate-300 mb-1">Payment Amount</span>
							<input
								type="number"
								name="amount"
								step="0.01"
								placeholder="Payment amount"
								required
								aria-label="Payment amount"
								className="h-10 w-full px-4 py-2 bg-slate-900/40 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
							/>
						</label>
						<button
							type="submit"
							className="h-10 px-6 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-lg hover:shadow-xl cursor-pointer"
						>
							Make Payment
						</button>
					</form>

					{payments.length > 0 && (
						<div className="mt-4 pt-4 border-t border-white/10">
							<div className="text-xs text-slate-400 mb-2">Recent Payments</div>
							<div className="space-y-1">
								{payments.slice(-3).reverse().map((payment) => (
									<div key={payment.id} className="flex justify-between text-sm">
										<span className="text-slate-400">
											{new Date(payment.date).toLocaleDateString()}
										</span>
										<span className="font-semibold text-emerald-400">
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
