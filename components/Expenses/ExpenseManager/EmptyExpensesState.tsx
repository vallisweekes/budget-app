"use client";

import Link from "next/link";
import { Plus, TrendingUp } from "lucide-react";

type Props = {
	incomeHref: string;
	hasSearch: boolean;
	onAddClick: () => void;
};

export default function EmptyExpensesState({ incomeHref, hasSearch, onAddClick }: Props) {
	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-xl p-16 text-center border border-white/10">
			<div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
				<span className="text-6xl">📝</span>
			</div>
			<h3 className="text-2xl font-bold text-white mb-3">{hasSearch ? "No matching expenses" : "No expenses yet"}</h3>
			<p className="text-slate-400 text-lg mb-6">
				{hasSearch
					? "Try a different search term"
					: 'Click "Add Expense" to track your first expense — or switch tabs/month/year to view expenses in a different plan or period.'}
			</p>

			{!hasSearch ? (
				<div className="flex flex-col items-center gap-4">
					<button
						type="button"
						onClick={onAddClick}
						className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
					>
						<Plus size={20} />
						Add Expense
					</button>

					<div className="w-full mt-6 pt-6 border-t border-white/10">
						<div className="flex items-center justify-center gap-2 text-slate-400 mb-4">
							<TrendingUp size={20} />
							<span className="font-semibold">Pro tip:</span>
						</div>
						<p className="text-slate-300 mb-4">Start by adding your income to get a complete budget overview</p>
						<Link
							href={incomeHref}
							className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
						>
							<Plus size={20} />
							Add Income First
						</Link>
					</div>
				</div>
			) : null}
		</div>
	);
}
