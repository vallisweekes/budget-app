"use client";

import { ChevronDown } from "lucide-react";

import DebtCard from "./DebtCard";
import { formatCurrency } from "@/lib/helpers/money";
import type { DebtPayment } from "@/types";
import type { DebtCardDebt } from "@/types/components/debts";

export default function ExpenseDebtGroup({
	groupKey,
	title,
	debts,
	totalCurrentBalance,
	totalDue,
	paymentsMap,
	budgetPlanId,
	typeLabels,
	payDate,
	isOpen,
	onToggle,
}: {
	groupKey: string;
	title: string;
	debts: DebtCardDebt[];
	totalCurrentBalance: number;
	totalDue: number;
	paymentsMap: Map<string, DebtPayment[]>;
	budgetPlanId: string;
	typeLabels: Record<string, string>;
	payDate: number;
	isOpen: boolean;
	onToggle: () => void;
}) {
	const count = debts.length;

	return (
		<div className="rounded-xl bg-slate-900/30 border border-white/10">
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={isOpen}
				className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left"
			>
				<div className="min-w-0 flex items-start gap-2">
					<ChevronDown
						size={16}
						className={`mt-0.5 shrink-0 text-slate-300 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
					/>
					<div className="min-w-0">
						<div className="text-sm font-semibold text-white truncate">{title}</div>
						<div className="text-[10px] sm:text-xs text-slate-400">
							{count} missed payment{count !== 1 ? "s" : ""} · Due this month {formatCurrency(totalDue)}
						</div>
					</div>
				</div>
				<div className="text-right shrink-0">
					<div className="text-[10px] sm:text-xs text-slate-400">Total outstanding</div>
					<div className="text-sm font-bold text-amber-400">{formatCurrency(totalCurrentBalance)}</div>
				</div>
			</button>

			{isOpen ? (
				<div className="px-3 pb-3 space-y-4">
					{debts.map((debt) => (
						<DebtCard
							key={`${groupKey}:${debt.id}`}
							debt={debt}
							budgetPlanId={budgetPlanId}
							typeLabels={typeLabels}
							payments={paymentsMap.get(debt.id) || []}
							payDate={payDate}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}
