"use client";

import { formatCurrency } from "@/lib/helpers/money";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export default function ExpenseRowPaymentSummary({
	paidAmount,
	remaining,
	totalAmount,
}: {
	paidAmount: number;
	remaining: number;
	totalAmount: number;
}) {
	return (
		<div className="w-full">
			<div className="text-[10px] sm:text-xs text-slate-400">
				Paid <span className="text-slate-200 font-medium"><Currency value={paidAmount} /></span> · Remaining{" "}
				<span className="text-slate-200 font-medium"><Currency value={remaining} /></span>
			</div>
			<div className="mt-1.5 h-2 sm:h-4 w-full rounded-full bg-slate-900/40 border border-white/10 overflow-hidden">
				<div
					className={`h-full ${remaining === 0 ? "bg-emerald-500/70" : "bg-purple-500/70"}`}
					style={{ width: `${Math.min(100, (paidAmount / Math.max(1, totalAmount)) * 100)}%` }}
				/>
			</div>
		</div>
	);
}
