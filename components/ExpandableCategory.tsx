"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MonthKey } from "@/lib/budget/engine";
import CategoryIcon from "./CategoryIcon";
import PaymentStatusButton from "./PaymentStatusButton";

interface Expense {
	id: string;
	name: string;
	amount: number;
	paid: boolean;
	paidAmount?: number;
}

interface ExpandableCategoryProps {
	categoryName: string;
	categoryIcon: string;
	categoryColor?: string;
	expenses: Expense[];
	total: number;
	month: MonthKey;
	updatePaymentStatus: (month: MonthKey, id: string, status: "paid" | "unpaid" | "partial", partialAmount?: number) => Promise<void>;
}

function Currency({ value }: { value: number }) {
	return <span>{value.toLocaleString(undefined, { style: "currency", currency: "GBP" })}</span>;
}

export default function ExpandableCategory({
	categoryName,
	categoryIcon,
	categoryColor = "blue",
	expenses,
	total,
	month,
	updatePaymentStatus,
}: ExpandableCategoryProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	// Color mapping for gradients and text
	const colorMap: Record<string, { bg: string; text: string }> = {
		blue: { bg: "from-blue-400 to-blue-600", text: "text-blue-600" },
		yellow: { bg: "from-yellow-400 to-yellow-600", text: "text-yellow-600" },
		purple: { bg: "from-purple-400 to-purple-600", text: "text-purple-600" },
		orange: { bg: "from-orange-400 to-orange-600", text: "text-orange-600" },
		green: { bg: "from-green-400 to-green-600", text: "text-green-600" },
		indigo: { bg: "from-indigo-400 to-indigo-600", text: "text-indigo-600" },
		pink: { bg: "from-pink-400 to-pink-600", text: "text-pink-600" },
		cyan: { bg: "from-cyan-400 to-cyan-600", text: "text-cyan-600" },
		red: { bg: "from-red-400 to-red-600", text: "text-red-600" },
		emerald: { bg: "from-emerald-400 to-emerald-600", text: "text-emerald-600" },
	};

	const colors = colorMap[categoryColor] || colorMap.blue;

	return (
		<div className="bg-slate-800/40 backdrop-blur-xl rounded-xl shadow-xl border border-white/10 overflow-hidden">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer"
			>
				<div className="flex items-center gap-4">
					<div className={`w-14 h-14 flex items-center justify-center bg-gradient-to-br ${colors.bg} rounded-2xl shadow-md`}>
						<CategoryIcon iconName={categoryIcon} size={28} className="text-white" />
					</div>
					<div>
						<div className="font-semibold text-left text-white">{categoryName}</div>
						<div className="text-sm text-slate-400">{expenses.length} items</div>
					</div>
				</div>
				<div className="flex items-center gap-4">
					<div className="text-right">
						<div className="font-bold text-lg text-white"><Currency value={total} /></div>
						<div className="text-xs text-slate-400">per month</div>
					</div>
					{isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
				</div>
			</button>
			
			{isExpanded && (
				<div className="border-t border-white/10 bg-slate-900/20">
					<div className="divide-y divide-white/5">
						{expenses.map((e) => (
							<div key={e.id} className="flex items-center justify-between p-3 px-4 hover:bg-white/5 transition-colors">
								<div className="flex items-center gap-3">
									<div className="text-sm font-medium text-white">{e.name}</div>
									<div className="text-xs text-slate-400"><Currency value={e.amount} /></div>
								</div>
								<PaymentStatusButton
									expenseName={e.name}
									amount={e.amount}
									paid={e.paid}
									paidAmount={e.paidAmount || 0}
									month={month}
									id={e.id}
									updatePaymentStatus={updatePaymentStatus}
								/>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
