"use client";

import { PiggyBank, TrendingUp } from "lucide-react";
import PaymentStatusButton from "./PaymentStatusButton";
import type { MonthKey } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";
import { getSimpleColorClasses } from "@/lib/helpers/colors";

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
	return <span>{formatCurrency(value)}</span>;
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
	const colors = getSimpleColorClasses(color, "purple");

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
