"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type { MonthKey } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";

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
	return <span>{formatCurrency(value)}</span>;
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
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [partialValue, setPartialValue] = useState(paidAmount || 0);
	const [showPartialInput, setShowPartialInput] = useState(false);
	const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

	const menuWidth = 256;
	const viewportPadding = 12;
	const menuOffset = 8;

	const canUseDOM = useMemo(() => typeof window !== "undefined" && typeof document !== "undefined", []);

	function closeMenu() {
		setIsOpen(false);
		setShowPartialInput(false);
	}

	function updateMenuPosition() {
		const el = buttonRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const rawLeft = rect.right - menuWidth;
		const left = Math.max(viewportPadding, Math.min(rawLeft, window.innerWidth - menuWidth - viewportPadding));
		const top = Math.max(viewportPadding, Math.min(rect.bottom + menuOffset, window.innerHeight - viewportPadding));
		setMenuPosition({ top, left });
	}

	useLayoutEffect(() => {
		if (!canUseDOM) return;
		if (!isOpen) return;
		updateMenuPosition();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, canUseDOM]);

	useEffect(() => {
		if (!canUseDOM) return;
		if (!isOpen) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeMenu();
		};
		const onScrollOrResize = () => updateMenuPosition();

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("scroll", onScrollOrResize, true);
		window.addEventListener("resize", onScrollOrResize);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("scroll", onScrollOrResize, true);
			window.removeEventListener("resize", onScrollOrResize);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, canUseDOM]);

	const handleStatusChange = async (status: "paid" | "unpaid" | "partial") => {
		if (status === "partial") {
			setShowPartialInput(true);
		} else {
			await updatePaymentStatus(month, id, status);
			closeMenu();
		}
	};

	const handlePartialSubmit = async () => {
		await updatePaymentStatus(month, id, "partial", partialValue);
		closeMenu();
	};

	const getStatusText = () => {
		if (paid) return "Paid";
		if (paidAmount > 0) return `Partial (${formatCurrency(paidAmount)})`;
		return "Unpaid";
	};

	const getStatusColor = () => {
		if (paid) return "bg-emerald-500/20 text-emerald-400";
		if (paidAmount > 0) return "bg-amber-500/20 text-amber-400";
		return "bg-red-500/20 text-red-400";
	};

	return (
		<div className="relative">
			<button
				ref={buttonRef}
				onClick={() => {
					setIsOpen((v) => {
						const next = !v;
						if (next) updateMenuPosition();
						return next;
					});
				}}
				className={`h-8 sm:h-9 min-w-[76px] sm:min-w-[88px] px-2 sm:px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium cursor-pointer transition-all shadow-sm hover:shadow-md hover:scale-[1.02] flex items-center justify-center gap-1 sm:gap-1.5 ${getStatusColor()}`}
			>
				{getStatusText()}
				<ChevronDown size={12} className="sm:w-3.5 sm:h-3.5" />
			</button>


			{isOpen && canUseDOM && menuPosition
				? createPortal(
					<>
						<div className="fixed inset-0 z-[9998]" onClick={closeMenu} />
						<div
							className="fixed w-64 bg-slate-950/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 z-[9999] overflow-hidden"
							style={{ top: menuPosition.top, left: menuPosition.left }}
							aria-label={`${expenseName} payment status`}
						>
							{!showPartialInput ? (
								<div className="p-2">
									<button
										onClick={() => handleStatusChange("paid")}
										className="w-full text-left px-3 py-2 hover:bg-white/10 focus:bg-white/10 rounded-xl transition-colors text-sm font-medium text-emerald-400"
									>
										Paid
									</button>
									<button
										onClick={() => handleStatusChange("partial")}
										className="w-full text-left px-3 py-2 hover:bg-white/10 focus:bg-white/10 rounded-xl transition-colors text-sm font-medium text-amber-400"
									>
										Partially Paid
									</button>
									<button
										onClick={() => handleStatusChange("unpaid")}
										className="w-full text-left px-3 py-2 hover:bg-white/10 focus:bg-white/10 rounded-xl transition-colors text-sm font-medium text-red-400"
									>
										Unpaid
									</button>
								</div>
							) : (
								<div className="p-4">
									<div className="mb-3">
										<label className="block text-sm font-medium text-slate-300 mb-2">
											Amount Paid
										</label>
										<input
											type="number"
											value={partialValue}
											onChange={(e) => setPartialValue(Number(e.target.value))}
											max={amount}
											min={0}
											step="0.01"
											className="w-full px-3 py-2 border border-white/10 bg-slate-900/40 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50"
											placeholder="0.00"
										/>
										<p className="text-xs text-slate-400 mt-1">
											Total: <Currency value={amount} />
										</p>
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => setShowPartialInput(false)}
											className="flex-1 px-3 py-2 border border-white/10 bg-slate-900/40 text-slate-200 rounded-xl hover:bg-slate-900/60 transition-colors text-sm font-medium"
										>
											Cancel
										</button>
										<button
											onClick={handlePartialSubmit}
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
				)
				: null}
		</div>
	);
}
