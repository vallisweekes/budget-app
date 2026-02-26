"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SelectDropdownProps, SelectOption } from "@/components/Shared/SelectDropdown.types";
import SelectDropdownMenu from "@/components/Shared/SelectDropdownMenu";
import { useAnchoredMenuPosition } from "@/lib/hooks/useAnchoredMenuPosition";

export type { SelectDropdownProps, SelectOption };

function cx(...classes: Array<string | undefined | null | false>) {
	return classes.filter(Boolean).join(" ");
}

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

	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const { menuPosition, updateMenuPosition } = useAnchoredMenuPosition({
		open,
		anchorRef: triggerRef,
		optionsLength: options.length,
	});

	const close = () => setOpen(false);
	function focusOptionAt(index: number) {
		requestAnimationFrame(() => {
			optionRefs.current[index]?.focus();
		});
	}

	function openMenu() {
		if (disabled) return;
		const idx = options.findIndex((o) => o.value === selectedValue);
		const nextActive = idx >= 0 ? idx : 0;
		setActiveIndex(nextActive);
		updateMenuPosition();
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
		if (!open) return;
		function onEscape(e: KeyboardEvent) {
			if (e.key !== "Escape") return;
			e.preventDefault();
			close();
		}
		window.addEventListener("keydown", onEscape);
		return () => {
			window.removeEventListener("keydown", onEscape);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	useEffect(() => {
		if (!open) return;
		focusOptionAt(Math.min(activeIndex, Math.max(0, options.length - 1)));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [options.length, open]);

	const baseButton =
		"flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left outline-none transition-all";
	const isLight = variant === "light";
	const buttonStyles = isLight
		? "border-zinc-300 bg-white text-zinc-900 focus:ring-2 focus:ring-[var(--cta)]"
		: "border-white/10 bg-slate-900/40 text-white focus:ring-2 focus:ring-[var(--cta)]";

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
		<div className={cx("relative", className)}>
			{name ? <input type="hidden" name={name} value={selectedValue} /> : null}

			<button
				id={controlId}
				ref={triggerRef}
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
						<div className={cx("mt-1 text-xs", isLight ? "text-zinc-500" : "text-white/50")}>Required</div>
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

			<SelectDropdownMenu
				open={open}
				menuPosition={menuPosition}
				controlId={controlId}
				options={options}
				selectedValue={selectedValue}
				activeIndex={activeIndex}
				setActiveIndex={setActiveIndex}
				setValue={setValue}
				close={close}
				optionRefs={optionRefs}
				move={move}
				variant={variant}
				menuClassName={menuClassName}
			/>
		</div>
	);
}
