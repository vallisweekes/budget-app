"use client";

import { useState } from "react";
import { ChevronDown, CreditCard, TrendingDown, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/money";

interface DebtCategoryProps {
	debts: any[];
	totalBalance: number;
}

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function DebtCategory({ debts, totalBalance }: DebtCategoryProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	const typeIcons = {
		credit_card: CreditCard,
		loan: TrendingDown,
		hire_purchase: ShoppingBag,
	};

	const typeLabels = {
		credit_card: "Credit Card",
		loan: "Loan",
		hire_purchase: "Hire Purchase",
	};

	return (
		<div className="bg-white rounded-xl shadow-sm overflow-hidden">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors"
			>
				<div className="flex items-center gap-3">
					<div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
						<CreditCard className="w-6 h-6 text-white" />
					</div>
					<div className="text-left">
						<h3 className="font-semibold text-zinc-800">Loans & Debts</h3>
						<p className="text-sm text-zinc-500">{debts.length} debt{debts.length !== 1 ? 's' : ''}</p>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<div className="text-right">
						<div className="text-xl font-bold text-red-600">
							<Currency value={totalBalance} />
						</div>
					</div>
					<ChevronDown
						className={`w-5 h-5 text-zinc-400 transition-transform ${
							isExpanded ? "rotate-180" : ""
						}`}
					/>
				</div>
			</button>

			{isExpanded && (
				<div className="border-t border-zinc-100 p-4 space-y-3 bg-zinc-50">
					{debts.map((debt) => {
						const Icon = typeIcons[debt.type as keyof typeof typeIcons] || CreditCard;
						const percentPaid = ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100;

						return (
							<div
								key={debt.id}
								className="bg-white rounded-lg p-3 flex items-center justify-between"
							>
								<div className="flex items-center gap-3 flex-1">
									<div className="p-2 bg-red-100 rounded-lg">
										<Icon className="w-4 h-4 text-red-600" />
									</div>
									<div className="flex-1">
										<div className="font-medium text-zinc-800">{debt.name}</div>
										<div className="text-xs text-zinc-500">
											{typeLabels[debt.type as keyof typeof typeLabels]}
											{debt.monthlyMinimum && (
												<span className="ml-2">
													• Min: <Currency value={debt.monthlyMinimum} />
												</span>
											)}
										</div>
										{/* Mini progress bar */}
										<div className="w-full bg-zinc-200 rounded-full h-1 mt-1">
											<div
												className="bg-emerald-500 h-1 rounded-full"
												style={{ width: `${Math.min(100, percentPaid)}%` }}
											/>
										</div>
									</div>
								</div>
								<div className="text-right ml-3">
									<div className="text-lg font-bold text-red-600">
										<Currency value={debt.currentBalance} />
									</div>
									<div className="text-xs text-zinc-400">
										of <Currency value={debt.initialBalance} />
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
