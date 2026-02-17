"use client";

type Props = {
	applyRemainingMonths: boolean;
	setApplyRemainingMonths: (value: boolean) => void;
	applyFutureYears: boolean;
	setApplyFutureYears: (value: boolean) => void;
};

export default function EditExpenseApplyScope({
	applyRemainingMonths,
	setApplyRemainingMonths,
	applyFutureYears,
	setApplyFutureYears,
}: Props) {
	return (
		<div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
			<div className="text-sm font-semibold text-white mb-2">Apply changes to…</div>
			<label className="flex items-center gap-2 text-sm text-slate-200">
				<input
					id="applyRemainingMonths"
					name="applyRemainingMonths"
					type="checkbox"
					checked={applyRemainingMonths}
					onChange={(e) => setApplyRemainingMonths(e.target.checked)}
					className="h-4 w-4 rounded border-white/20 bg-slate-900/40 text-purple-500 focus:ring-purple-500/50"
				/>
				Remaining months (same year)
			</label>
			<label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
				<input
					name="applyFutureYears"
					type="checkbox"
					disabled={!applyRemainingMonths}
					checked={applyFutureYears}
					onChange={(e) => setApplyFutureYears(e.target.checked)}
					className="h-4 w-4 rounded border-white/20 bg-slate-900/40 text-purple-500 focus:ring-purple-500/50 disabled:opacity-60"
				/>
				Future years (same month/day)
			</label>
		</div>
	);
}
