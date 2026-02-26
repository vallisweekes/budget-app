import type React from "react";
import { createPortal } from "react-dom";
import type { SelectOption } from "@/components/Shared/SelectDropdown.types";

function cx(...classes: Array<string | undefined | null | false>) {
	return classes.filter(Boolean).join(" ");
}

export default function SelectDropdownMenu({
	open,
	menuPosition,
	controlId,
	options,
	selectedValue,
	activeIndex,
	setActiveIndex,
	setValue,
	close,
	optionRefs,
	move,
	variant,
	menuClassName,
}: {
	open: boolean;
	menuPosition: { left: number; top: number; width: number } | null;
	controlId: string;
	options: SelectOption[];
	selectedValue: string;
	activeIndex: number;
	setActiveIndex: (idx: number) => void;
	setValue: (value: string) => void;
	close: () => void;
	optionRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>;
	move: (delta: number) => void;
	variant: "dark" | "light";
	menuClassName?: string;
}) {
	if (!open || !menuPosition) return null;

	const baseMenu = "max-h-72 overflow-auto rounded-2xl border shadow-2xl backdrop-blur-xl";
	const isLight = variant === "light";
	const menuStyles = isLight ? "border-zinc-200 bg-white/95" : "border-white/10 bg-slate-950/80";

	const optionBase = "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm outline-none transition";
	const optionStyles = isLight
		? "text-zinc-900 hover:bg-zinc-100 focus:bg-zinc-100"
		: "text-white hover:bg-white/10 focus:bg-white/10";
	const optionActive = isLight ? "bg-zinc-100" : "bg-white/10";
	const optionSelected = "text-[var(--cta)]";

	return createPortal(
		<>
			<button
				type="button"
				aria-label="Close"
				className="fixed inset-0 z-[9998] cursor-default"
				onClick={() => close()}
			/>
			<div
				role="listbox"
				aria-labelledby={controlId}
				className={cx(baseMenu, menuStyles, "fixed z-[9999]", menuClassName)}
				style={{ left: menuPosition.left, top: menuPosition.top, width: menuPosition.width }}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown") {
						e.preventDefault();
						move(1);
					}
					if (e.key === "ArrowUp") {
						e.preventDefault();
						move(-1);
					}
					if (e.key === "Home") {
						e.preventDefault();
						setActiveIndex(0);
						optionRefs.current[0]?.focus();
					}
					if (e.key === "End") {
						e.preventDefault();
						const last = Math.max(0, options.length - 1);
						setActiveIndex(last);
						optionRefs.current[last]?.focus();
					}
				}}
			>
				<div className="p-2">
					{options.map((opt, idx) => {
						const isSelected = opt.value === selectedValue;
						const isActive = idx === activeIndex;
						return (
							<button
								key={opt.value}
								type="button"
								role="option"
								aria-selected={isSelected}
								disabled={opt.disabled}
								ref={(el) => {
									optionRefs.current[idx] = el;
								}}
								onMouseEnter={() => setActiveIndex(idx)}
								onClick={() => {
									if (opt.disabled) return;
									setValue(opt.value);
									close();
								}}
								className={cx(
									optionBase,
									optionStyles,
									opt.disabled && "opacity-50 cursor-not-allowed",
									isActive && optionActive
								)}
							>
								<span className={cx("truncate", isSelected && optionSelected)}>{opt.label}</span>
								{isSelected ? <span className={cx("text-xs font-semibold", optionSelected)}>✓</span> : null}
							</button>
						);
					})}
				</div>
			</div>
		</>,
		document.body
	);
}
