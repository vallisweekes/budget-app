"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

export type SelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};

function cx(...classes: Array<string | undefined | null | false>) {
	return classes.filter(Boolean).join(" ");
}

export type SelectDropdownProps = {
	options: SelectOption[];
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	placeholder?: string;
	name?: string;
	disabled?: boolean;
	required?: boolean;
	variant?: "dark" | "light";
	className?: string;
	buttonClassName?: string;
	menuClassName?: string;
	id?: string;
};

export default function SelectDropdown({
	options,
	value,
	defaultValue,
	onValueChange,
	placeholder = "Select…",
	name,
	disabled,
	required,
	variant = "dark",
	className,
	buttonClassName,
	menuClassName,
	id,
}: SelectDropdownProps) {
	const internalId = useId();
	const controlId = id ?? `select-${internalId}`;

	const isControlled = value !== undefined;
	const [uncontrolledValue, setUncontrolledValue] = useState<string>(defaultValue ?? "");
	const selectedValue = isControlled ? value! : uncontrolledValue;

	const selected = useMemo(() => options.find((o) => o.value === selectedValue) ?? null, [options, selectedValue]);

	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState<number>(() => {
		const idx = options.findIndex((o) => o.value === selectedValue);
		return idx >= 0 ? idx : 0;
	});

	const rootRef = useRef<HTMLDivElement | null>(null);
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

	const close = () => setOpen(false);
	function focusOptionAt(index: number) {
		// Defer until after the menu has been rendered.
		requestAnimationFrame(() => {
			optionRefs.current[index]?.focus();
		});
	}

	function openMenu() {
		if (disabled) return;
		const idx = options.findIndex((o) => o.value === selectedValue);
		const nextActive = idx >= 0 ? idx : 0;
		setActiveIndex(nextActive);
		setOpen(true);
		focusOptionAt(nextActive);
	}

	function toggle() {
		if (open) {
			close();
			return;
		}
		openMenu();
	}

	function setValue(next: string) {
		if (!isControlled) setUncontrolledValue(next);
		onValueChange?.(next);
	}

	useEffect(() => {
		function onDocPointerDown(e: MouseEvent | TouchEvent) {
			const target = e.target as Node | null;
			if (!target) return;
			if (!rootRef.current?.contains(target)) close();
		}
		document.addEventListener("mousedown", onDocPointerDown);
		document.addEventListener("touchstart", onDocPointerDown);
		return () => {
			document.removeEventListener("mousedown", onDocPointerDown);
			document.removeEventListener("touchstart", onDocPointerDown);
		};
	}, []);

	useEffect(() => {
		if (!open) return;
		// Keep focus aligned when options change while open.
		focusOptionAt(Math.min(activeIndex, Math.max(0, options.length - 1)));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [options.length, open]);

	const baseButton = "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left outline-none transition-all";
	const baseMenu = "absolute left-0 right-0 mt-2 max-h-72 overflow-auto rounded-2xl border shadow-2xl backdrop-blur-xl";

	const isLight = variant === "light";
	const buttonStyles = isLight
		? "border-zinc-300 bg-white text-zinc-900 focus:ring-2 focus:ring-blue-500"
		: "border-white/10 bg-slate-900/40 text-white focus:ring-2 focus:ring-blue-500";

	const menuStyles = isLight ? "border-zinc-200 bg-white/95" : "border-white/10 bg-slate-950/80";

	const optionBase = "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm outline-none transition";
	const optionStyles = isLight
		? "text-zinc-900 hover:bg-zinc-100 focus:bg-zinc-100"
		: "text-white hover:bg-white/10 focus:bg-white/10";

	const optionActive = isLight ? "bg-zinc-100" : "bg-white/10";
	const optionSelected = isLight ? "text-blue-700" : "text-blue-200";

	function move(delta: number) {
		if (options.length === 0) return;
		let next = activeIndex;
		for (let i = 0; i < options.length; i++) {
			next = (next + delta + options.length) % options.length;
			if (!options[next]?.disabled) break;
		}
		setActiveIndex(next);
		optionRefs.current[next]?.focus();
	}

	return (
		<div ref={rootRef} className={cx("relative", className)}>
			{/* Hidden input for form submissions */}
			{name ? (
				<input type="hidden" name={name} value={selectedValue} />
			) : null}

			<button
				id={controlId}
				type="button"
				disabled={disabled}
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => {
					if (disabled) return;
					toggle();
				}}
				onKeyDown={(e) => {
					if (disabled) return;
					if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						openMenu();
					}
				}}
				className={cx(baseButton, buttonStyles, buttonClassName)}
			>
				<div className="min-w-0">
					<div className={cx("truncate", selected ? "" : isLight ? "text-zinc-500" : "text-white/60")}>
						{selected ? selected.label : placeholder}
					</div>
					{required && !selectedValue ? (
						<div className={cx("mt-1 text-xs", isLight ? "text-zinc-500" : "text-white/50")}>
							Required
						</div>
					) : null}
				</div>
				<svg
					width="18"
					height="18"
					viewBox="0 0 20 20"
					fill="none"
					aria-hidden="true"
					className={cx("shrink-0", isLight ? "text-zinc-600" : "text-white/60")}
				>
					<path
						d="M5.5 7.5L10 12l4.5-4.5"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>

			{open ? (
				<div
					role="listbox"
					aria-labelledby={controlId}
					className={cx(baseMenu, menuStyles, "z-50", menuClassName)}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							e.preventDefault();
							close();
							return;
						}
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
									{isSelected ? (
										<span className={cx("text-xs font-semibold", optionSelected)}>✓</span>
									) : null}
								</button>
							);
						})}
					</div>
				</div>
			) : null}
		</div>
	);
}
