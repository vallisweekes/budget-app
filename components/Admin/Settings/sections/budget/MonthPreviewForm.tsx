"use client";

import { MONTHS } from "@/lib/constants/time";
import { SelectDropdown } from "@/components/Shared";
import type { MonthKey } from "@/types";

export default function MonthPreviewForm({ selectedMonth }: { selectedMonth: MonthKey }) {
	return (
		<form method="get" className="flex items-end gap-2">
			<label className="block">
				<span className="text-xs font-medium text-slate-400 mb-2 block">Preview month</span>
				<SelectDropdown
					name="month"
					defaultValue={selectedMonth}
					options={MONTHS.map((m) => ({ value: m, label: m }))}
					buttonClassName="bg-slate-900/60 px-3 py-2 focus:ring-pink-500"
				/>
			</label>
			<button
				type="submit"
				className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition"
			>
				View
			</button>
		</form>
	);
}
