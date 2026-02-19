"use client";

import Link from "next/link";
import { ArrowRight, Plus, TrendingUp } from "lucide-react";

import type { EmptyExpensesJumpTarget } from "@/types/expenses-manager";

type Props = {
	incomeHref: string;
	hasSearch: boolean;
	onAddClick: () => void;
	jumpTarget?: EmptyExpensesJumpTarget | null;
	onJumpToTarget?: (target: EmptyExpensesJumpTarget) => void;
	hasAnyIncome?: boolean;
	monthLabel: string;
};

export default function EmptyExpensesState({
	incomeHref,
	hasSearch,
	onAddClick,
	jumpTarget,
	onJumpToTarget,
	hasAnyIncome,
	monthLabel,
}: Props) {
	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl p-16 text-center border border-white/10">
			<div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
				<span className="text-4xl">📝</span>
			</div>
			<h3 className="text-2xl font-bold text-white mb-3">
				{hasSearch ? "No matching expenses" : `No expenses added for ${monthLabel}`}
			</h3>
			{hasSearch ? <p className="text-slate-400 text-lg mb-6">Try a different search term</p> : null}

			{!hasSearch ? (
				<div className="flex flex-col items-center gap-4">
					{jumpTarget && onJumpToTarget ? (
						<button
							type="button"
							onClick={() => onJumpToTarget(jumpTarget)}
							className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-semibold border border-white/10 shadow-lg hover:bg-white/15 hover:shadow-xl hover:scale-[1.02] transition-all"
							title={jumpTarget.label}
						>
							<ArrowRight size={20} />
							{jumpTarget.label}
						</button>
					) : null}

					<button
						type="button"
						onClick={onAddClick}
						className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
					>
						<Plus size={20} />
						Add Expense for {monthLabel}
					</button>

					{!hasAnyIncome ? (
						<div className="w-full mt-6 pt-6 border-t border-white/10">
							<div className="flex items-center justify-center gap-2 text-slate-400 mb-4">
								<TrendingUp size={20} />
								<span className="font-semibold">Pro tip:</span>
							</div>
							<p className="text-slate-300 mb-4">Start by adding your income to get a complete budget overview</p>
							<Link
								href={incomeHref}
								className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
							>
								<Plus size={20} />
								Add Income First
							</Link>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
