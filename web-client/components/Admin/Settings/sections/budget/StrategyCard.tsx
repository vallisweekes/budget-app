"use client";

import { Lightbulb } from "lucide-react";

import { InfoTooltip, SelectDropdown } from "@/components/Shared";
import { saveSettingsAction } from "@/lib/settings/actions";
import type { Settings } from "@/lib/settings/store";

export default function StrategyCard({
	budgetPlanId,
	budgetStrategy,
}: {
	budgetPlanId: string;
	budgetStrategy: Settings["budgetStrategy"];
}) {
	return (
		<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
			<div className="flex items-center gap-3 mb-6">
				<div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
					<Lightbulb className="w-5 h-5 text-slate-200" />
				</div>
				<div>
					<h3 className="text-xl font-bold text-white inline-flex items-center gap-2">
						Budget Strategy
						<InfoTooltip
							ariaLabel="Budget strategy info"
							content="Choose a budgeting style (e.g. zero-based, 50/30/20) to enable extra guidance and summaries."
						/>
					</h3>
					<p className="text-slate-400 text-sm">Optional. Turn on features like zero-based budgeting.</p>
				</div>
			</div>

			<form action={saveSettingsAction} className="space-y-4">
				<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
				<label className="block">
					<span className="text-sm font-medium text-slate-400 mb-2 block">Strategy</span>
					<SelectDropdown
						name="budgetStrategy"
						defaultValue={budgetStrategy ?? ""}
						options={[
							{ value: "", label: "None" },
							{ value: "zeroBased", label: "Zero-based budgeting (ZBB)" },
							{ value: "fiftyThirtyTwenty", label: "50/30/20 rule" },
							{ value: "payYourselfFirst", label: "Pay yourself first" },
						]}
						buttonClassName="bg-slate-900/60 focus:ring-pink-500"
					/>
				</label>
				<button
					type="submit"
					className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
				>
					Save Strategy
				</button>
			</form>
		</div>
	);
}
