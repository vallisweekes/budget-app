"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MonthKey } from "@/lib/budget/engine";

interface PaymentStatusButtonProps {
	expenseName: string;
	amount: number;
	paid: boolean;
	paidAmount: number;
	month: MonthKey;
	id: string;
	updatePaymentStatus: (month: MonthKey, id: string, status: "paid" | "unpaid" | "partial", partialAmount?: number) => Promise<void>;
}

function Currency({ value }: { value: number }) {
	return <span>{value.toLocaleString(undefined, { style: "currency", currency: "GBP" })}</span>;
}

export default function PaymentStatusButton({
	expenseName,
	amount,
	paid,
	paidAmount,
	month,
	id,
	updatePaymentStatus,
}: PaymentStatusButtonProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [partialValue, setPartialValue] = useState(paidAmount || 0);
	const [showPartialInput, setShowPartialInput] = useState(false);

	const handleStatusChange = async (status: "paid" | "unpaid" | "partial") => {
		if (status === "partial") {
			setShowPartialInput(true);
		} else {
			await updatePaymentStatus(month, id, status);
			setIsOpen(false);
			setShowPartialInput(false);
		}
	};

	const handlePartialSubmit = async () => {
		await updatePaymentStatus(month, id, "partial", partialValue);
		setIsOpen(false);
		setShowPartialInput(false);
	};

	const getStatusText = () => {
		if (paid) return "Paid in Full";
		if (paidAmount > 0) return `Partial (${Currency({ value: paidAmount })})`;
		return "Not Paid";
	};

	const getStatusColor = () => {
		if (paid) return "text-emerald-600 bg-emerald-50";
		if (paidAmount > 0) return "text-amber-600 bg-amber-50";
		return "text-red-600 bg-red-50";
	};

	return (
		<div className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${getStatusColor()}`}
			>
				{getStatusText()}
				<ChevronDown size={16} />
			</button>

			{isOpen && (
				<>
					<div
						className="fixed inset-0 z-10"
						onClick={() => {
							setIsOpen(false);
							setShowPartialInput(false);
						}}
					/>
					<div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-zinc-200 z-20 overflow-hidden">
						{!showPartialInput ? (
							<div className="p-2">
								<button
									onClick={() => handleStatusChange("paid")}
									className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-lg transition-colors text-sm font-medium text-emerald-700"
								>
									✓ Paid in Full
								</button>
								<button
									onClick={() => handleStatusChange("partial")}
									className="w-full text-left px-4 py-3 hover:bg-amber-50 rounded-lg transition-colors text-sm font-medium text-amber-700"
								>
									◐ Partially Paid
								</button>
								<button
									onClick={() => handleStatusChange("unpaid")}
									className="w-full text-left px-4 py-3 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium text-red-700"
								>
									✗ Not Paid
								</button>
							</div>
						) : (
							<div className="p-4">
								<div className="mb-3">
									<label className="block text-sm font-medium text-zinc-700 mb-2">
										Amount Paid
									</label>
									<input
										type="number"
										value={partialValue}
										onChange={(e) => setPartialValue(Number(e.target.value))}
										max={amount}
										min={0}
										step="0.01"
										className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
									/>
									<p className="text-xs text-zinc-500 mt-1">
										Total: <Currency value={amount} />
									</p>
								</div>
								<button
									onClick={handlePartialSubmit}
									className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
								>
									Save
								</button>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}
