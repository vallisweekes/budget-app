"use client";

import { PiggyBank, TrendingUp } from "lucide-react";
import PaymentStatusButton from "./PaymentStatusButton";
import type { MonthKey } from "@/lib/budget/engine";

interface SavingCardProps {
	name: string;
	amount: number;
	paid: boolean;
	paidAmount?: number;
	isInvestment?: boolean;
	month: MonthKey;
	id: string;
	updatePaymentStatus: (month: MonthKey, id: string, status: "paid" | "unpaid" | "partial", partialAmount?: number) => Promise<void>;
}

function Currency({ value }: { value: number }) {
	return <span>{value.toLocaleString(undefined, { style: "currency", currency: "GBP" })}</span>;
}

export default function SavingCard({
	name,
	amount,
	paid,
	paidAmount = 0,
	isInvestment,
	month,
	id,
	updatePaymentStatus,
}: SavingCardProps) {
	const color = isInvestment ? "emerald" : "purple";
	const Icon = isInvestment ? TrendingUp : PiggyBank;
	
	const colorMap: Record<string, { bg: string; text: string }> = {
		purple: { bg: "from-purple-400 to-purple-600", text: "text-purple-600" },
		emerald: { bg: "from-emerald-400 to-emerald-600", text: "text-emerald-600" },
	};

	const colors = colorMap[color];

	return (
		<div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
			<div className="flex items-center gap-4">
				<div className={`w-14 h-14 flex items-center justify-center bg-gradient-to-br ${colors.bg} rounded-2xl shadow-md`}>
					<Icon size={28} className="text-white" />
				</div>
				<div>
					<div className="font-semibold text-zinc-800">{name}</div>
					<div className="text-sm text-zinc-500">{isInvestment ? "Investment" : "Saving"}</div>
				</div>
			</div>
			<div className="flex items-center gap-4">
				<div className="text-right">
					<div className="font-bold text-lg"><Currency value={amount} /></div>
				</div>
				<PaymentStatusButton
					expenseName={name}
					amount={amount}
					paid={paid}
					paidAmount={paidAmount}
					month={month}
					id={id}
					updatePaymentStatus={updatePaymentStatus}
				/>
			</div>
		</div>
	);
}
