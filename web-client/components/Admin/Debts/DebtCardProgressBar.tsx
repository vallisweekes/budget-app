"use client";

export default function DebtCardProgressBar(props: { percentPaid: number }) {
	const { percentPaid } = props;

	return (
		<div className="mt-3 sm:mt-4">
			<div className="flex justify-between text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">
				<span>Progress</span>
				<span>{percentPaid.toFixed(1)}% paid</span>
			</div>
			<div className="w-full bg-white/10 rounded-full h-2 sm:h-4">
				<div
					className="bg-gradient-to-r from-emerald-400 to-green-500 h-2 sm:h-4 rounded-full transition-all"
					style={{ width: `${Math.min(100, percentPaid)}%` }}
				/>
			</div>
		</div>
	);
}
