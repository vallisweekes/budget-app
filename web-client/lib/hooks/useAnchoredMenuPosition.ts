import { useCallback, useEffect, useState } from "react";

export type AnchoredMenuPosition = { left: number; top: number; width: number } | null;

export function useAnchoredMenuPosition(params: {
	open: boolean;
	anchorRef: React.RefObject<HTMLElement | null>;
	optionsLength: number;
	offset?: number;
	padding?: number;
	maxHeight?: number;
	itemHeight?: number;
}): {
	menuPosition: AnchoredMenuPosition;
	updateMenuPosition: () => void;
} {
	const {
		open,
		anchorRef,
		optionsLength,
		offset = 8,
		padding = 8,
		maxHeight = 288,
		itemHeight = 44,
	} = params;

	const [menuPosition, setMenuPosition] = useState<AnchoredMenuPosition>(null);

	const updateMenuPosition = useCallback(() => {
		const anchor = anchorRef.current;
		if (!anchor) return;
		const rect = anchor.getBoundingClientRect();
		const width = rect.width;
		let left = rect.left;
		let top = rect.bottom + offset;

		// Keep within viewport horizontally.
		const viewportWidth = window.innerWidth;
		if (left + width > viewportWidth - padding) {
			left = Math.max(padding, viewportWidth - width - padding);
		}
		if (left < padding) left = padding;

		// If the menu would overflow the bottom, flip it above.
		const estimatedHeight = Math.min(maxHeight, itemHeight * Math.max(1, optionsLength));
		const viewportHeight = window.innerHeight;
		if (top + estimatedHeight > viewportHeight - padding) {
			top = Math.max(padding, rect.top - offset - estimatedHeight);
		}

		setMenuPosition({ left, top, width });
	}, [anchorRef, itemHeight, maxHeight, offset, optionsLength, padding]);

	useEffect(() => {
		if (!open) return;
		updateMenuPosition();
		function onScrollOrResize() {
			updateMenuPosition();
		}
		window.addEventListener("scroll", onScrollOrResize, true);
		window.addEventListener("resize", onScrollOrResize);
		return () => {
			window.removeEventListener("scroll", onScrollOrResize, true);
			window.removeEventListener("resize", onScrollOrResize);
		};
	}, [open, updateMenuPosition]);

	return { menuPosition, updateMenuPosition };
}
