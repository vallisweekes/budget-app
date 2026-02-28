"use client";

import { createPortal } from "react-dom";

import { formatCurrency } from "@/lib/helpers/money";
import MoneyInput from "@/components/Shared/MoneyInput";

function Currency({ value }: { value: number }) {
	return <span>{formatCurrency(value)}</span>;
}

export interface PaymentStatusButtonMenuProps {
	expenseName: string;
	amount: number;
	currencyCode?: string;
	country?: string;
	language?: string;
	isOpen: boolean;
	canUseDOM: boolean;
	menuPosition: { top: number; left: number } | null;
	showPartialInput: boolean;
	partialValue: string;
	onPartialValueChange: (next: string) => void;
	onClose: () => void;
	onChooseStatus: (status: "paid" | "unpaid" | "partial") => void;
	onSubmitPartial: () => void;
	onCancelPartial: () => void;
}

export default function PaymentStatusButtonMenu({
	expenseName,
	amount,
	currencyCode,
	country,
	language,
	isOpen,
	canUseDOM,
	menuPosition,
	showPartialInput,
	partialValue,
	onPartialValueChange,
	onClose,
	onChooseStatus,
	onSubmitPartial,
	onCancelPartial,
}: PaymentStatusButtonMenuProps) {
	if (!isOpen || !canUseDOM || !menuPosition) return null;

	return createPortal(
		<>
			<div className="fixed inset-0 z-[9998]" onClick={onClose} />
			<div
				className="fixed w-64 bg-slate-950/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 z-[9999] overflow-hidden"
				style={{ top: menuPosition.top, left: menuPosition.left }}
				aria-label={`${expenseName} payment status`}
			>
				{!showPartialInput ? (
					<div className="p-2">
						<button
							onClick={() => onChooseStatus("paid")}
							className="w-full text-left px-3 py-2 hover:bg-white/10 focus:bg-white/10 rounded-xl transition-colors text-sm font-medium text-emerald-400"
						>
							Paid
						</button>
						<button
							onClick={() => onChooseStatus("partial")}
							className="w-full text-left px-3 py-2 hover:bg-white/10 focus:bg-white/10 rounded-xl transition-colors text-sm font-medium text-amber-400"
						>
							Partially Paid
						</button>
						<button
							onClick={() => onChooseStatus("unpaid")}
							className="w-full text-left px-3 py-2 hover:bg-white/10 focus:bg-white/10 rounded-xl transition-colors text-sm font-medium text-red-400"
						>
							Unpaid
						</button>
					</div>
				) : (
					<div className="p-4">
						<div className="mb-3">
							<label className="block text-sm font-medium text-slate-300 mb-2">Amount Paid</label>
							<MoneyInput
								value={partialValue}
								onChangeValue={onPartialValueChange}
								currencyCode={currencyCode ?? "GBP"}
								country={country ?? "GB"}
								language={language ?? "en"}
								placeholder="0.00"
								autoFocus
							/>
							<p className="text-xs text-slate-400 mt-1">
								Total: <Currency value={amount} />
							</p>
						</div>
						<div className="flex gap-2">
							<button
								onClick={onCancelPartial}
								className="flex-1 px-3 py-2 border border-white/10 bg-slate-900/40 text-slate-200 rounded-xl hover:bg-slate-900/60 transition-colors text-sm font-medium"
							>
								Cancel
							</button>
							<button
								onClick={onSubmitPartial}
								className="flex-1 px-3 py-2 bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] text-white rounded-xl transition-colors text-sm font-medium shadow-lg"
							>
								Save
							</button>
						</div>
					</div>
				)}
			</div>
		</>,
		document.body
	);
}
