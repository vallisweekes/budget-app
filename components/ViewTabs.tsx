"use client";

import { ShoppingBag } from "lucide-react";
import type { MonthKey } from "@/types";
import ExpandableCategory from "./ExpandableCategory";
import SavingCard from "./SavingCard";
import GoalsDisplay from "./GoalsDisplay";
import { updatePaymentStatus } from "@/lib/expenses/actions";
import { updateDebtPaymentStatus } from "@/lib/debts/payment-actions";
import { formatCurrency } from "@/lib/helpers/money";

interface ViewTabsProps {
	budgetPlanId: string;
	month: MonthKey;
	categoryData: any[];
	regularExpenses: any[];
	totalIncome: number;
	totalExpenses: number;
	remaining: number;
	debts: any[];
	totalDebtBalance: number;
	goals: any[];
}

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function ViewTabs({
	budgetPlanId,
	month,
	categoryData,
	regularExpenses,
	totalIncome,
	totalExpenses,
	remaining,
	debts,
	totalDebtBalance,
	goals,
}: ViewTabsProps) {
	const updateExpensePaymentStatus = (
		m: MonthKey,
		id: string,
		status: "paid" | "unpaid" | "partial",
		partialAmount?: number
	) => updatePaymentStatus(budgetPlanId, m, id, status, partialAmount);

	const updateDebtPaymentStatusScoped = (
		m: MonthKey,
		id: string,
		status: "paid" | "unpaid" | "partial",
		partialAmount?: number
	) => updateDebtPaymentStatus(budgetPlanId, m, id, status, partialAmount);

	// Calculate debt (unpaid or partially paid items)
	const debtExpenses = regularExpenses.filter(e => !e.paid || (e.paidAmount && e.paidAmount < e.amount));
	
	const totalDebt = debtExpenses.reduce((sum, item) => {
		const owed = item.amount - (item.paidAmount || 0);
		return sum + owed;
	}, 0);

	// Calculate investments total
	const investmentsCategory = categoryData.find(cat => cat.id === 'investments');
	const totalInvestments = investmentsCategory ? investmentsCategory.total : 0;

	// Calculate total monthly debt payments (sum of debt amounts, not balances)
	const totalDebtPayments = debts.reduce((sum, debt) => sum + debt.amount, 0);

	return (
		<>
			{/* Balance Overview Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
				{/* Investments Card */}
				<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/10 hover:border-white/20 hover:shadow-2xl transition-all min-h-[120px] flex flex-col justify-between">
					<div className="text-sm text-slate-400 font-medium mb-1 uppercase tracking-wide">Investments</div>
					<div className="text-3xl font-bold text-white leading-none"><Currency value={totalInvestments} /></div>
				</div>
				
				{/* Outstanding Debt Card */}
				<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/10 hover:border-white/20 hover:shadow-2xl transition-all min-h-[120px] flex flex-col justify-between">
					<div className="text-sm text-slate-400 font-medium mb-1 uppercase tracking-wide">Outstanding Debt</div>
					<div className="text-3xl font-bold text-red-400 leading-none"><Currency value={totalDebtBalance} /></div>
				</div>
				
				{/* Total Balance Card */}
				<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/10 hover:border-white/20 hover:shadow-2xl transition-all min-h-[120px] flex flex-col justify-between">
					<div className="text-sm text-slate-400 font-medium mb-1 uppercase tracking-wide">Balance</div>
					<div className="text-3xl font-bold text-emerald-400 leading-none"><Currency value={remaining} /></div>
				</div>
			</div>

			{/* Goals */}
			<GoalsDisplay goals={goals} />

			{/* All Categories in Grid */}
			{(debts.length > 0 || categoryData.length > 0) && (
				<div className="mb-8">
					<div className="flex items-center gap-3 mb-4">
						<div className="bg-white/10 p-2.5 rounded-xl shadow-md backdrop-blur-sm">
							<ShoppingBag size={24} className="text-white" />
						</div>
						<h2 className="text-xl font-semibold text-white">Expenses by Category</h2>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{/* Loans & Debts Category */}
						{debts && debts.length > 0 && (
							<ExpandableCategory
								key="loans-debts"
								categoryName="Loans & Debts"
								categoryIcon="credit-card"
								categoryColor="red"
								expenses={debts}
								total={totalDebtPayments}
								month={month}
								updatePaymentStatus={updateDebtPaymentStatusScoped}
							/>
						)}
						
						{/* Regular Categories */}
						{categoryData.map((cat) => (
							<ExpandableCategory
								key={cat.id}
								categoryName={cat.name}
								categoryIcon={cat.icon}
								categoryColor={cat.color}
								expenses={cat.expenses}
								total={cat.total}
								month={month}
								updatePaymentStatus={updateExpensePaymentStatus}
							/>
						))}
					</div>
				</div>
			)}
		</>
	);
}
