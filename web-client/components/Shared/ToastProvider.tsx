"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";

type ToastTone = "error" | "success" | "info";

type ToastItem = {
	id: string;
	message: string;
	tone: ToastTone;
	leaving?: boolean;
};

type ToastContextValue = {
	error: (message: string) => void;
	success: (message: string) => void;
	info: (message: string) => void;
	dismiss: (id: string) => void;
	push: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toastId() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<ToastItem[]>([]);

	const dismiss = useCallback((id: string) => {
		setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
		window.setTimeout(() => {
			setItems((prev) => prev.filter((t) => t.id !== id));
		}, 220);
	}, []);

	const push = useCallback(
		(message: string, tone: ToastTone = "error") => {
			const id = toastId();
			setItems((prev) => [...prev, { id, message, tone }]);
			window.setTimeout(() => dismiss(id), 3500);
		},
		[dismiss]
	);

	const value = useMemo<ToastContextValue>(
		() => ({
			push,
			dismiss,
			error: (m) => push(m, "error"),
			success: (m) => push(m, "success"),
			info: (m) => push(m, "info"),
		}),
		[push, dismiss]
	);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
				{items.map((t) => (
					<div
						key={t.id}
						className={`pointer-events-auto toast-slide-in rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-xl ${
							t.leaving ? "toast-slide-out" : ""
						} ${
							t.tone === "error"
								? "border-red-400/30 bg-red-950/40 text-red-50"
								: t.tone === "success"
									? "border-emerald-400/30 bg-emerald-950/40 text-emerald-50"
									: "border-sky-400/30 bg-sky-950/40 text-sky-50"
						}`}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="text-sm font-medium leading-snug">{t.message}</div>
							<button
								type="button"
								onClick={() => dismiss(t.id)}
								className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-slate-900/20 text-white/80 hover:bg-slate-900/40"
								aria-label="Dismiss"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast() {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used within ToastProvider");
	return ctx;
}
