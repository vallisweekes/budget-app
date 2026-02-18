"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MONTHS } from "@/lib/constants/time";
import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";
import { SelectDropdown } from "@/components/Shared";
import AllocationsSaveButton from "./AllocationsSaveButton";

export default function AllocationsMonthSaveRow(props: {
	formId: string;
	month: MonthKey;
	year: number;
	isOverride: boolean;
	resetToDefault?: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const [dirty, setDirty] = useState(false);

	useEffect(() => {
		const form = document.getElementById(props.formId) as HTMLFormElement | null;
		if (!form) return;

		function markDirty() {
			setDirty(true);
		}

		function clearDirty() {
			setDirty(false);
		}

		form.addEventListener("input", markDirty);
		form.addEventListener("change", markDirty);
		form.addEventListener("submit", clearDirty);
		return () => {
			form.removeEventListener("input", markDirty);
			form.removeEventListener("change", markDirty);
			form.removeEventListener("submit", clearDirty);
		};
	}, [props.formId]);

	const savedValue = searchParams.get("saved");
	const isSaved = savedValue === "allocations" || savedValue === "allocationsReset";

	const helperText = useMemo(() => {
		return `${props.isOverride ? "Custom for this month" : "Using plan default"} (year ${props.year})`;
	}, [props.isOverride, props.year]);

	const status = isSaved
		? {
				label: savedValue === "allocationsReset" ? "Reset" : "Saved",
				className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
			}
		: dirty
			? { label: "Unsaved changes", className: "border-amber-300/20 bg-amber-400/10 text-amber-100" }
			: null;

	return (
		<>
			<label className="md:col-span-8">
				<span className="block text-sm font-medium text-slate-300 mb-2">Month</span>
				<SelectDropdown
					name="month"
					defaultValue={props.month}
					options={MONTHS.map((m) => ({ value: m, label: formatMonthKeyLabel(m) }))}
					buttonClassName="bg-slate-900/60 focus:ring-emerald-500"
					onValueChange={(next) => {
						const nextMonth = next as MonthKey;
						if (nextMonth === props.month) return;

						if (dirty) {
							const ok = window.confirm(
								"You have unsaved changes. Switch month and discard them?"
							);
							if (!ok) return;
						}

						setDirty(false);
						const nextParams = new URLSearchParams(searchParams.toString());
						nextParams.set("month", nextMonth);
						nextParams.set("tab", "allocations");
						nextParams.delete("saved");
						const qs = nextParams.toString();
						router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
					}}
				/>
			</label>

			<div className="md:col-span-4 flex items-end">
				<AllocationsSaveButton dirty={dirty} />
			</div>

			<div className="md:col-span-12 -mt-2 flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<p className="text-xs text-slate-400">{helperText}</p>
					{dirty ? (
						<button
							type="button"
							onClick={() => {
								const form = document.getElementById(props.formId) as HTMLFormElement | null;
								form?.reset();
								setDirty(false);
							}}
							className="text-xs font-medium text-slate-300 hover:text-white underline decoration-white/20 hover:decoration-white/40 transition"
						>
							Reset
						</button>
					) : null}
					{props.resetToDefault ? <div className="hidden md:block">{props.resetToDefault}</div> : null}
				</div>
				{status ? (
					<div className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${status.className}`}>
						{status.label}
					</div>
				) : null}
			</div>
			{props.resetToDefault ? <div className="md:hidden -mt-1">{props.resetToDefault}</div> : null}
		</>
	);
}
