"use client";

import { createPortal } from "react-dom";

export default function InfoTooltipPopover({
	open,
	tooltipId,
	anchor,
	content,
	onMouseEnter,
	onMouseLeave,
}: {
	open: boolean;
	tooltipId: string;
	anchor: { left: number; top: number } | null;
	content: string;
	onMouseEnter: () => void;
	onMouseLeave: () => void;
}) {
	if (!open) return null;
	if (!anchor) return null;
	if (typeof document === "undefined") return null;

	return createPortal(
		<div
			id={tooltipId}
			role="tooltip"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			className="fixed z-[1000] w-72 -translate-x-1/2 rounded-xl bg-black/90 px-3 py-2 text-xs leading-relaxed text-white shadow-2xl ring-1 ring-white/10"
			style={{ left: anchor.left, top: anchor.top }}
		>
			{content}
		</div>,
		document.body
	);
}
