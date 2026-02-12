import React, { forwardRef } from "react";

type SelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};

function cx(...classes: Array<string | undefined | null | false>) {
	return classes.filter(Boolean).join(" ");
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
	variant?: "dark" | "light";
	options?: SelectOption[];
	placeholder?: string;
	containerClassName?: string;
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
	{ variant = "dark", options, placeholder, className, containerClassName, children, ...props },
	ref
) {
	const base =
		"w-full appearance-none rounded-xl border pr-10 outline-none transition-all disabled:opacity-50";

	const variantClasses =
		variant === "light"
			? "border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			: "border-white/10 bg-slate-900/40 px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent";

	const iconClasses = variant === "light" ? "text-zinc-500" : "text-white/60";

	return (
		<div className={cx("relative", containerClassName)}>
			<select ref={ref} className={cx(base, variantClasses, className)} {...props}>
				{placeholder ? (
					<option value="" disabled hidden>
						{placeholder}
					</option>
				) : null}
				{options
					? options.map((opt) => (
							<option key={opt.value} value={opt.value} disabled={opt.disabled}>
								{opt.label}
							</option>
						))
					: children}
			</select>
			<div className={cx("pointer-events-none absolute inset-y-0 right-3 flex items-center", iconClasses)}>
				<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
					<path
						d="M5.5 7.5L10 12l4.5-4.5"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</div>
		</div>
	);
});

export default Select;
