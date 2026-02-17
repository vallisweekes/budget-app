"use client";

import { useState, useMemo } from "react";
import DebtCard from "./DebtCard";
import type { DebtPayment, DebtType } from "@/types";
import DebtsSortControls from "./DebtsSortControls";
import DebtsEmptyState from "./DebtsEmptyState";
import ExpenseDebtGroup from "./ExpenseDebtGroup";
import type { DebtCardDebt } from "./debtCardTypes";

interface DebtsListProps {
	debts: DebtCardDebt[];
	budgetPlanId: string;
	typeLabels: Record<string, string>;
	paymentsMap: Map<string, DebtPayment[]>;
	payDate: number;
}

type SortOption = "default" | "name" | "amount";

export default function DebtsList({ debts, budgetPlanId, typeLabels, paymentsMap, payDate }: DebtsListProps) {
	const [sortBy, setSortBy] = useState<SortOption>("default");
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

	const toggleGroup = (key: string) => {
		setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
	};

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
			{ key: string; title: string; debts: DebtCardDebt[]; totalCurrentBalance: number; totalDue: number }
		>();
		const passthrough: DebtCardDebt[] = [];

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
					key,
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

		type ListItem =
			| {
					kind: "expenseGroup";
					key: string;
					title: string;
					debts: DebtCardDebt[];
					totalCurrentBalance: number;
					totalDue: number;
			  }
			| { kind: "debt"; debt: DebtCardDebt };
		const items: ListItem[] = [];

		for (const group of grouped) {
			group.debts.sort((a, b) => (a.sourceMonthKey ?? "").localeCompare(b.sourceMonthKey ?? ""));
			items.push({
				kind: "expenseGroup",
				key: group.key,
				title: group.title,
				debts: group.debts,
				totalCurrentBalance: group.totalCurrentBalance,
				totalDue: group.totalDue,
			});
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
					if (item.kind === "expenseGroup") {
						const isOpen = openGroups[item.key] ?? item.debts.length === 1;
						return (
							<ExpenseDebtGroup
								key={`expenseGroup:${item.key}`}
								groupKey={item.key}
								title={item.title}
								debts={item.debts}
								totalCurrentBalance={item.totalCurrentBalance}
								totalDue={item.totalDue}
								paymentsMap={paymentsMap}
								budgetPlanId={budgetPlanId}
								typeLabels={typeLabels}
								payDate={payDate}
								isOpen={isOpen}
								onToggle={() => toggleGroup(item.key)}
							/>
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
