"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MonthKey } from "@/types";
import { formatCurrency } from "@/lib/helpers/money";
import { parseMoney } from "@/lib/helpers/moneyInput";
import PaymentStatusButtonMenu from "@/components/PaymentStatusButtonMenu";

interface PaymentStatusButtonProps {
	expenseName: string;
	amount: number;
	paid: boolean;
	paidAmount: number;
	month: MonthKey;
	id: string;
	updatePaymentStatus: (month: MonthKey, id: string, status: "paid" | "unpaid" | "partial", partialAmount?: number) => Promise<void>;
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
	const [partialValueDraft, setPartialValueDraft] = useState(paidAmount > 0 ? paidAmount.toFixed(2) : "");
	const [showPartialInput, setShowPartialInput] = useState(false);
	const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
	const [settings, setSettings] = useState<{ currency: string; country: string; language: string }>({
		currency: "GBP",
		country: "GB",
		language: "en",
	});

	useEffect(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				const res = await fetch("/api/bff/settings", { signal: controller.signal });
				if (!res.ok) return;
				const body = (await res.json()) as any;
				const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "GBP";
				const country = typeof body?.country === "string" && body.country.trim() ? body.country.trim() : "GB";
				const language = typeof body?.language === "string" && body.language.trim() ? body.language.trim() : "en";
				setSettings({ currency, country, language });
			} catch {
				// ignore
			}
		})();
		return () => controller.abort();
	}, []);

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
			setPartialValueDraft(paidAmount > 0 ? paidAmount.toFixed(2) : "");
			setShowPartialInput(true);
		} else {
			await updatePaymentStatus(month, id, status);
			closeMenu();
		}
	};

	const handlePartialSubmit = async () => {
		const parsed = parseMoney(partialValueDraft);
		const clamped = parsed == null ? 0 : Math.max(0, Math.min(amount, parsed));
		await updatePaymentStatus(month, id, "partial", clamped);
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

			<PaymentStatusButtonMenu
				expenseName={expenseName}
				amount={amount}
				currencyCode={settings.currency}
				country={settings.country}
				language={settings.language}
				isOpen={isOpen}
				canUseDOM={canUseDOM}
				menuPosition={menuPosition}
				showPartialInput={showPartialInput}
				partialValue={partialValueDraft}
				onPartialValueChange={setPartialValueDraft}
				onClose={closeMenu}
				onChooseStatus={handleStatusChange}
				onSubmitPartial={handlePartialSubmit}
				onCancelPartial={() => setShowPartialInput(false)}
			/>
		</div>
	);
}
