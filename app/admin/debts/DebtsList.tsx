"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUpAZ, DollarSign } from "lucide-react";
import DebtCard from "./DebtCard";
import type { DebtPayment, DebtType } from "@/types";

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
}

interface DebtsListProps {
	debts: Debt[];
	budgetPlanId: string;
	typeLabels: Record<string, string>;
	paymentsMap: Map<string, DebtPayment[]>;
	payDate: number;
}

type SortOption = "default" | "name" | "amount";

export default function DebtsList({ debts, budgetPlanId, typeLabels, paymentsMap, payDate }: DebtsListProps) {
	const [sortBy, setSortBy] = useState<SortOption>("default");

	// Sort debts based on current sort option
	const sortedDebts = useMemo(() => {
		const sorted = [...debts];

		if (sortBy === "default") {
			return sorted;
		}

		if (sortBy === "name") {
			sorted.sort((a, b) => a.name.localeCompare(b.name));
		} else if (sortBy === "amount") {
			sorted.sort((a, b) => b.currentBalance - a.currentBalance);
		}

		return sorted;
	}, [debts, sortBy]);

	if (debts.length === 0) {
		return (
			<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-8 text-center border border-white/10">
				<div className="text-6xl mb-4">🎉</div>
				<h3 className="text-xl font-semibold text-white mb-2">No Debts!</h3>
				<p className="text-slate-400">You have no tracked debts at the moment.</p>
			</div>
		);
	}

	return (
		<>
			{/* Sort Controls */}
			<div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
				<span className="text-xs sm:text-sm text-slate-400">Sort by:</span>
				<div className="flex gap-1.5 sm:gap-2">
					<button
						onClick={() => setSortBy("default")}
						className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-1.5 ${
							sortBy === "default"
								? "bg-purple-600 text-white"
								: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40"
						}`}
					>
						<ArrowUpDown className="w-3 h-3 sm:w-4 sm:h-4" />
						Default
					</button>
					<button
						onClick={() => setSortBy("name")}
						className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-1.5 ${
							sortBy === "name"
								? "bg-purple-600 text-white"
								: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40"
						}`}
					>
						<ArrowUpAZ className="w-3 h-3 sm:w-4 sm:h-4" />
						Name
					</button>
					<button
						onClick={() => setSortBy("amount")}
						className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-1.5 ${
							sortBy === "amount"
								? "bg-purple-600 text-white"
								: "bg-slate-800/40 text-slate-300 hover:bg-slate-700/40"
						}`}
					>
						<DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
						Amount
					</button>
				</div>
			</div>

			{/* Debts List */}
			<div className="space-y-4">
				{sortedDebts.map((debt) => (
					<DebtCard
						key={debt.id}
						debt={debt}
						budgetPlanId={budgetPlanId}
						typeLabels={typeLabels}
						payments={paymentsMap.get(debt.id) || []}
						payDate={payDate}
					/>
				))}
			</div>
		</>
	);
}
