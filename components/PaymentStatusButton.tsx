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
		if (paid) return "Paid in Full";
		if (paidAmount > 0) return `Partial (${formatCurrency(paidAmount)})`;
		return "Unpaid";
	};

	const getStatusColor = () => {
		if (paid) return "text-emerald-600 bg-emerald-50";
		if (paidAmount > 0) return "text-amber-600 bg-amber-50";
		return "text-red-600 bg-red-50";
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
				className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium cursor-pointer transition-colors ${getStatusColor()}`}
			>
				{getStatusText()}
				<ChevronDown size={12} className="sm:w-3.5 sm:h-3.5" />
			</button>


			{isOpen && canUseDOM && menuPosition
				? createPortal(
					<>
						<div className="fixed inset-0 z-[9998]" onClick={closeMenu} />
						<div
							className="fixed w-64 bg-white rounded-xl shadow-xl border border-zinc-200 z-[9999] overflow-hidden"
							style={{ top: menuPosition.top, left: menuPosition.left }}
							aria-label={`${expenseName} payment status`}
						>
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
					</>,
					document.body
				)
				: null}
		</div>
	);
}
