"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import SvgClose from "@/components/Shared/CloseIcon";

export default function InfoTooltipSheet({
	open,
	onOpenChange,
	content,
	ariaLabel,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	content: string;
	ariaLabel?: string;
}) {
	const [sheetMounted, setSheetMounted] = useState(false);
	const [sheetVisible, setSheetVisible] = useState(false);
	const [dragY, setDragY] = useState(0);
	const [dragging, setDragging] = useState(false);

	const touchStartYRef = useRef<number | null>(null);
	const dragYRef = useRef<number>(0);

	const closeSheet = () => {
		setDragging(false);
		dragYRef.current = 0;
		setDragY(0);
		setSheetVisible(false);
		onOpenChange(false);

		window.setTimeout(() => {
			setSheetMounted(false);
		}, 220);
	};

	const setDrag = (next: number) => {
		dragYRef.current = next;
		setDragY(next);
	};

	const endDrag = () => {
		const shouldClose = dragYRef.current > 80;
		touchStartYRef.current = null;
		setDragging(false);

		if (shouldClose) {
			closeSheet();
		} else {
			setDrag(0);
		}
	};

	useEffect(() => {
		if (open) {
			setSheetMounted(true);
			requestAnimationFrame(() => setSheetVisible(true));
			return;
		}

		if (sheetMounted) closeSheet();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	useEffect(() => {
		if (!sheetMounted) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeSheet();
		};

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sheetMounted]);

	useEffect(() => {
		if (!sheetMounted) return;
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, [sheetMounted]);

	if (!sheetMounted) return null;
	if (typeof document === "undefined") return null;

	return createPortal(
		<div className="fixed inset-0 z-[1000]">
			<button
				type="button"
				aria-label="Close"
				onClick={closeSheet}
				className={
					"absolute inset-0 bg-black/60 transition-opacity duration-200 " +
					(sheetVisible ? "opacity-100" : "opacity-0")
				}
			/>

			<div
				role="dialog"
				aria-modal="true"
				aria-label={ariaLabel ?? "Info"}
				className="absolute inset-x-0 bottom-0"
				style={{
					transform: sheetVisible ? `translateY(${dragY}px)` : "translateY(110%)",
					transition: dragging ? "none" : "transform 220ms ease",
				}}
			>
				<div
					className="mx-auto w-full rounded-t-3xl border border-white/10 bg-slate-950/95 text-white shadow-2xl backdrop-blur"
					style={{ height: "clamp(240px, 35vh, 440px)" }}
				>
					<div
						className="relative flex h-full flex-col p-4"
						style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
					>
						<div
							className="select-none"
							style={{ touchAction: "none" }}
							onPointerDown={(e) => {
								// Drag down anywhere in the top region (handle/title) to dismiss.
								if (e.button !== 0) return;
								touchStartYRef.current = e.clientY;
								setDragging(true);
								setDrag(0);
								(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
							}}
							onPointerMove={(e) => {
								const startY = touchStartYRef.current;
								if (startY == null) return;
								const delta = Math.max(0, e.clientY - startY);
								setDrag(delta);
							}}
							onPointerUp={endDrag}
							onPointerCancel={endDrag}
						>
							<div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-white/20" />

							<div className="flex items-start justify-between gap-3 pr-10">
								<div className="text-sm font-semibold">What this means</div>
							</div>
						</div>

						<button
							type="button"
							onClick={closeSheet}
							onPointerDown={(e) => e.stopPropagation()}
							aria-label="Close"
							className="absolute right-4 top-2 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/60 bg-slate-950/95 text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
						>
							<SvgClose className="h-4 w-4" fill="currentColor" />
						</button>

						<div className="mt-2 flex-1 overflow-y-auto text-sm leading-relaxed text-slate-200">{content}</div>
					</div>
				</div>
			</div>
		</div>,
		document.body
	);
}
