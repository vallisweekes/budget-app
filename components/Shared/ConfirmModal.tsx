"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ConfirmModalTone = "danger" | "default";

interface ConfirmModalProps {
	open: boolean;
	title: string;
	description?: string;
	children?: ReactNode;
	confirmText?: string;
	cancelText?: string;
	tone?: ConfirmModalTone;
	isBusy?: boolean;
	confirmDisabled?: boolean;
	onConfirm: () => void;
	onClose: () => void;
}

export default function ConfirmModal({
	open,
	title,
	description,
	children,
	confirmText = "Confirm",
	cancelText = "Cancel",
	tone = "default",
	isBusy = false,
	confirmDisabled = false,
	onConfirm,
	onClose,
}: ConfirmModalProps) {
	const titleId = useId();
	const descriptionId = useId();
	const previouslyFocused = useRef<HTMLElement | null>(null);
	const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		if (!open) return;

		previouslyFocused.current = document.activeElement as HTMLElement | null;
		cancelButtonRef.current?.focus();

		return () => {
			previouslyFocused.current?.focus?.();
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				if (!isBusy) onClose();
			}

			if (e.key === "Enter") {
				const active = document.activeElement as HTMLElement | null;
				const isTextInput =
					active?.tagName === "TEXTAREA" ||
					(active?.tagName === "INPUT" &&
						(active as HTMLInputElement).type !== "button" &&
						(active as HTMLInputElement).type !== "submit");

				if (!isTextInput) {
					e.preventDefault();
					if (!isBusy && !confirmDisabled) onConfirm();
				}
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, isBusy, confirmDisabled, onClose, onConfirm]);

	if (!open) return null;

	const confirmButtonClassName =
		tone === "danger"
			? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500"
			: "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500";

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
			<button
				type="button"
				className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
				onClick={() => {
					if (!isBusy) onClose();
				}}
				aria-label="Close dialog"
			/>

			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={description ? descriptionId : undefined}
				className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-800/50 backdrop-blur-xl shadow-2xl"
			>
				<div className="p-6">
					<h2 id={titleId} className="text-xl font-bold text-white">
						{title}
					</h2>

					{description && (
						<p id={descriptionId} className="mt-2 text-sm text-slate-300">
							{description}
						</p>
					)}

					{children && <div className="mt-4">{children}</div>}

					<div className="mt-6 flex items-center justify-end gap-3">
						<button
							ref={cancelButtonRef}
							type="button"
							onClick={() => {
								if (!isBusy) onClose();
							}}
							disabled={isBusy}
							className="h-10 px-4 rounded-xl border border-white/10 bg-slate-900/40 text-slate-200 hover:bg-slate-900/60 transition-all disabled:opacity-50"
						>
							{cancelText}
						</button>

						<button
							type="button"
							onClick={() => {
								if (!isBusy) onConfirm();
							}}
							disabled={isBusy || confirmDisabled}
							className={`h-10 px-4 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all ${confirmButtonClassName} disabled:opacity-50`}
						>
							{isBusy ? "Working…" : confirmText}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
