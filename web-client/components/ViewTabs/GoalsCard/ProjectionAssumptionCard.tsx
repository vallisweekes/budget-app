import type { MonthlyAssumptionsDraft } from "@/types";

import { Card, InfoTooltip } from "@/components/Shared";

export default function ProjectionAssumptionCard({
	title,
	tooltip,
	nowLabel,
	value,
	field,
	clearZeroOnFocus,
	normalizeOnBlur,
	setAssumption,
}: {
	title: string;
	tooltip: string;
	nowLabel: string;
	value: string;
	field: keyof MonthlyAssumptionsDraft;
	clearZeroOnFocus: (field: keyof MonthlyAssumptionsDraft) => void;
	normalizeOnBlur: (field: keyof MonthlyAssumptionsDraft) => void;
	setAssumption: (field: keyof MonthlyAssumptionsDraft, raw: string) => void;
}) {
	return (
		<Card
			title={
				<div className="inline-flex items-center gap-1.5">
					<span>{title}</span>
					<InfoTooltip ariaLabel={`${title} projection info`} content={tooltip} />
				</div>
			}
			className="p-3 bg-white/5"
		>
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-3">
					<div className="text-sm text-slate-300">Now</div>
					<div className="text-base font-bold text-white">{nowLabel}</div>
				</div>
				<div>
					<div className="text-sm text-slate-300">Assumption</div>
					<div className="flex items-center gap-2">
						<input
							type="number"
							inputMode="numeric"
							min={0}
							step={50}
							value={value}
							placeholder="0"
							onFocus={() => clearZeroOnFocus(field)}
							onBlur={() => normalizeOnBlur(field)}
							onChange={(e) => setAssumption(field, e.target.value)}
							className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
							aria-label={`Monthly ${title.toLowerCase()} assumption`}
						/>
						<span className="text-xs text-slate-400 whitespace-nowrap">/ month</span>
					</div>
				</div>
			</div>
		</Card>
	);
}
