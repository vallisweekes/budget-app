"use client";

import { useState, useMemo } from "react";
import DebtCard from "./DebtCard";
import { formatCurrency } from "@/lib/helpers/money";
import type { DebtPayment, DebtType } from "@/types";
import DebtsSortControls from "./DebtsSortControls";
import DebtsEmptyState from "./DebtsEmptyState";

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

	const listItems = useMemo(() => {
		const hasExpenseDebts = debts.some((d) => d.sourceType === "expense");
		const sorted = [...debts];

		if (sortBy === "name") {
			sorted.sort((a, b) => a.name.localeCompare(b.name));
		} else if (sortBy === "amount") {
			sorted.sort((a, b) => b.currentBalance - a.currentBalance);
		}

		if (!hasExpenseDebts) {
			return sorted.map((debt) => ({ kind: "debt" as const, debt }));
		}

		const groups = new Map<
			string,
			{ title: string; debts: Debt[]; totalCurrentBalance: number; totalDue: number }
		>();
		const passthrough: Debt[] = [];

		for (const debt of sorted) {
			if (debt.sourceType !== "expense") {
				passthrough.push(debt);
				continue;
			}

			const baseName = (debt.sourceExpenseName ?? "").trim() || debt.name;
			const categoryName = (debt.sourceCategoryName ?? "").trim();
			const title = categoryName ? `${categoryName}: ${baseName}` : baseName;
			const key = `${categoryName.toLowerCase()}|${baseName.toLowerCase()}`;

			const existing = groups.get(key);
			if (existing) {
				existing.debts.push(debt);
				existing.totalCurrentBalance += debt.currentBalance;
				existing.totalDue += debt.amount;
			} else {
				groups.set(key, {
					title,
					debts: [debt],
					totalCurrentBalance: debt.currentBalance,
					totalDue: debt.amount,
				});
			}
		}

		const grouped = Array.from(groups.values());
		if (sortBy === "name") {
			grouped.sort((a, b) => a.title.localeCompare(b.title));
		} else if (sortBy === "amount") {
			grouped.sort((a, b) => b.totalCurrentBalance - a.totalCurrentBalance);
		}

		const items: Array<
			| { kind: "header"; title: string; totalCurrentBalance: number; totalDue: number; count: number }
			| { kind: "debt"; debt: Debt }
		> = [];

		for (const group of grouped) {
			group.debts.sort((a, b) => (a.sourceMonthKey ?? "").localeCompare(b.sourceMonthKey ?? ""));
			items.push({
				kind: "header",
				title: group.title,
				totalCurrentBalance: group.totalCurrentBalance,
				totalDue: group.totalDue,
				count: group.debts.length,
			});
			for (const debt of group.debts) items.push({ kind: "debt", debt });
		}

		for (const debt of passthrough) items.push({ kind: "debt", debt });
		return items;
	}, [debts, sortBy]);

	if (debts.length === 0) {
		return <DebtsEmptyState />;
	}

	return (
		<>
			<DebtsSortControls sortBy={sortBy} onSortChange={setSortBy} />

			{/* Debts List */}
			<div className="space-y-4">
				{listItems.map((item) => {
					if (item.kind === "header") {
						return (
							<div
								key={`header:${item.title}`}
								className="px-3 py-2 rounded-xl bg-slate-900/30 border border-white/10"
							>
								<div className="flex items-center justify-between gap-3">
									<div className="min-w-0">
										<div className="text-sm font-semibold text-white truncate">{item.title}</div>
										<div className="text-[10px] sm:text-xs text-slate-400">
											{item.count} missed item{item.count !== 1 ? "s" : ""} · Due this month {formatCurrency(item.totalDue)}
									</div>
									</div>
									<div className="text-right shrink-0">
										<div className="text-[10px] sm:text-xs text-slate-400">Total outstanding</div>
										<div className="text-sm font-bold text-amber-400">{formatCurrency(item.totalCurrentBalance)}</div>
									</div>
								</div>
							</div>
						);
					}

					return (
						<DebtCard
							key={item.debt.id}
							debt={item.debt}
							budgetPlanId={budgetPlanId}
							typeLabels={typeLabels}
							payments={paymentsMap.get(item.debt.id) || []}
							payDate={payDate}
						/>
					);
				})}
			</div>
		</>
	);
}
