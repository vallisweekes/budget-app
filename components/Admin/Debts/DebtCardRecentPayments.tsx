"use client";

import { formatCurrency } from "@/lib/helpers/money";
import type { DebtPayment } from "@/types";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function DebtCardRecentPayments(props: { payments: DebtPayment[] }) {
	const { payments } = props;
	if (payments.length === 0) return null;

	return (
		<div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
			<div className="text-[10px] sm:text-xs text-slate-400 mb-1.5 sm:mb-2">Recent Payments</div>
			<div className="space-y-0.5 sm:space-y-1">
				{payments
					.slice(-3)
					.reverse()
					.map((payment) => (
						<div
							key={payment.id}
							className="flex items-center justify-between gap-2 sm:gap-3 text-xs sm:text-sm"
						>
							<span className="text-slate-400">
								{new Date(payment.date).toLocaleDateString()}
								{payment.source ? (
									<span className="ml-2 text-xs text-slate-500">
										({payment.source === "extra_funds" ? "extra funds" : "income"})
									</span>
								) : null}
							</span>
							<span className="font-semibold text-emerald-400 whitespace-nowrap">-<Currency value={payment.amount} /></span>
						</div>
					))}
			</div>
		</div>
	);
}
