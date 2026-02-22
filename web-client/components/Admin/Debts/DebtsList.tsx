"use client";

import { useState } from "react";
import DebtCardLink from "./DebtCardLink";
import type { DebtPayment } from "@/types";
import type { DebtCardDebt } from "@/types/components/debts";
import DebtsSortControls from "./DebtsSortControls";
import DebtsEmptyState from "./DebtsEmptyState";
import ExpenseDebtGroup from "./ExpenseDebtGroup";
import { useDebtListItems } from "@/lib/hooks/debts/useDebtListItems";
import type { DebtSortOption } from "@/lib/helpers/debts/listItems";
import { getPaymentMonthKeyUTC } from "@/lib/helpers/debts/debtCard";

interface DebtsListProps {
	debts: DebtCardDebt[];
	creditCards: DebtCardDebt[];
	budgetPlanId: string;
	typeLabels: Record<string, string>;
	paymentsMap: Map<string, DebtPayment[]>;
	payDate: number;
	baseHref: string;
}

export default function DebtsList({ debts, creditCards, budgetPlanId, typeLabels, paymentsMap, payDate, baseHref }: DebtsListProps) {
	const [sortBy, setSortBy] = useState<DebtSortOption>("default");
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
	const paymentMonth = getPaymentMonthKeyUTC();

	const toggleGroup = (key: string) => {
		setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const listItems = useDebtListItems(debts, sortBy);

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
								creditCards={creditCards}
								totalCurrentBalance={item.totalCurrentBalance}
								totalDue={item.totalDue}
								paymentsMap={paymentsMap}
								budgetPlanId={budgetPlanId}
								typeLabels={typeLabels}
								payDate={payDate}
								baseHref={baseHref}
								paymentMonth={paymentMonth}
								isOpen={isOpen}
								onToggle={() => toggleGroup(item.key)}
							/>
						);
					}

					return (
						<DebtCardLink
							key={item.debt.id}
							debt={item.debt}
							budgetPlanId={budgetPlanId}
							typeLabels={typeLabels}
							baseHref={baseHref}
							payments={paymentsMap.get(item.debt.id) || []}
							paymentMonth={paymentMonth}
						/>
					);
				})}
			</div>
		</>
	);
}
