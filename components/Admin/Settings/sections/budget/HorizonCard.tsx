"use client";

import { CalendarDays } from "lucide-react";

import { InfoTooltip, SelectDropdown } from "@/components/Shared";
import { saveSettingsAction } from "@/lib/settings/actions";

export default function HorizonCard({
	budgetPlanId,
	budgetHorizonYears,
}: {
	budgetPlanId: string;
	budgetHorizonYears: number | null | undefined;
}) {
	return (
		<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
			<div className="flex items-center gap-3 mb-6">
				<div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
					<CalendarDays className="w-5 h-5 text-slate-200" />
				</div>
				<div>
					<h3 className="text-xl font-bold text-white inline-flex items-center gap-2">
						Budget horizon
						<InfoTooltip ariaLabel="Budget horizon info" content="Choose how many years ahead this plan covers." />
					</h3>
					<p className="text-slate-400 text-sm">Select how far ahead you plan.</p>
				</div>
			</div>

			<form action={saveSettingsAction} className="flex flex-col md:flex-row md:items-end gap-4">
				<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
				<label className="block md:flex-1">
					<span className="text-sm font-medium text-slate-400 mb-2 block">Years</span>
					<SelectDropdown
						name="budgetHorizonYears"
						defaultValue={String(budgetHorizonYears ?? 10)}
						options={[2, 5, 10, 15, 20, 25, 30].map((n) => ({ value: String(n), label: `${n} years` }))}
						buttonClassName="bg-slate-900/60 focus:ring-blue-500"
					/>
				</label>
				<button
					type="submit"
					className="w-full md:w-40 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
				>
					Save
				</button>
			</form>
		</div>
	);
}
