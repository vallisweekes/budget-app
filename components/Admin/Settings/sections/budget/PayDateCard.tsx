"use client";

import { useState } from "react";

import { CalendarDays } from "lucide-react";

import { InfoTooltip } from "@/components/Shared";
import { saveSettingsAction } from "@/lib/settings/actions";

export default function PayDateCard({
	budgetPlanId,
	payDateLabel,
	payDate,
}: {
	budgetPlanId: string;
	payDateLabel: string;
	payDate: number | null | undefined;
}) {
	const [isEditing, setIsEditing] = useState(false);

	return (
		<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
			<div className="flex items-center gap-3 mb-6">
				<div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
					<CalendarDays className="w-5 h-5 text-slate-200" />
				</div>
				<h3 className="text-xl font-bold text-white inline-flex items-center gap-2">
					Pay Date
					<InfoTooltip
						ariaLabel="Pay date info"
						content="The day of the month you typically get paid. Used as a default for due dates and monthly planning."
					/>
				</h3>
			</div>

			{!isEditing ? (
				<div className="space-y-4">
					<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4">
						<p className="text-xs font-medium text-slate-400">Current pay date</p>
						<p className="mt-1 text-2xl font-extrabold text-white">{payDateLabel}</p>
						<p className="mt-2 text-xs text-slate-500">Locked to prevent accidental changes.</p>
					</div>
					<button
						type="button"
						onClick={() => setIsEditing(true)}
						className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
					>
						Change pay date
					</button>
				</div>
			) : (
				<form action={saveSettingsAction} onSubmit={() => setIsEditing(false)} className="space-y-4">
					<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
					<label className="block">
						<span className="text-sm font-medium text-slate-400 mb-2 block">Day of Month</span>
						<input
							name="payDate"
							type="number"
							min={1}
							max={31}
							inputMode="numeric"
							defaultValue={payDate ?? 1}
							onWheel={(e) => {
								(e.currentTarget as HTMLInputElement).blur();
							}}
							className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
						/>
					</label>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setIsEditing(false)}
							className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
						>
							Cancel
						</button>
						<button
							type="submit"
							className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
						>
							Save
						</button>
					</div>
				</form>
			)}
		</div>
	);
}
