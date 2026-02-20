"use client";

import Link from "next/link";
import { CreditCard, TrendingDown, ShoppingBag, Home } from "lucide-react";
import DebtCardCollapsedSummary from "./DebtCardCollapsedSummary";
import type { DebtPayment } from "@/types";
import type { DebtCardDebt } from "@/types/components/debts";

const typeIcons = {
	credit_card: CreditCard,
	store_card: ShoppingBag,
	loan: TrendingDown,
	mortgage: Home,
	high_purchase: ShoppingBag,
	other: TrendingDown,
} as const;

function slugifySegment(value: string): string {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

function getPercentPaid(debt: DebtCardDebt): number {
	if (!Number.isFinite(debt.initialBalance) || debt.initialBalance <= 0) return 0;
	return ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100;
}

export default function DebtCardLink(props: {
	debt: DebtCardDebt;
	typeLabels: Record<string, string>;
	budgetPlanId: string;
	baseHref: string;
	payments: DebtPayment[];
	paymentMonth: string;
}) {
	const { debt, typeLabels, baseHref, payments, paymentMonth } = props;
	const Icon = typeIcons[debt.type as keyof typeof typeIcons] ?? CreditCard;
	const href = `${baseHref}/${encodeURIComponent(debt.id)}/${encodeURIComponent(slugifySegment(debt.name))}?view=true`;
	const percentPaid = getPercentPaid(debt);

	return (
		<Link
			href={href}
			className={
				"block bg-slate-800/40 backdrop-blur-xl rounded-xl sm:rounded-2xl border p-3 sm:p-5 hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--cta)]"
			}
			aria-label={`Open debt ${debt.name}`}
		>
			<div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
				<div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left">
					<div className="p-2 sm:p-2.5 bg-red-500/10 backdrop-blur-sm rounded-full shrink-0">
						<Icon className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="text-sm sm:text-base font-bold text-white truncate">{debt.name}</h3>
						<p className="text-[10px] sm:text-xs text-slate-400 truncate">
							{typeLabels[debt.type as keyof typeof typeLabels] ?? debt.type}
						</p>
					</div>
				</div>
			</div>

			<DebtCardCollapsedSummary
				debt={debt}
				percentPaid={percentPaid}
				payments={payments}
				paymentMonth={paymentMonth}
			/>
		</Link>
	);
}
