"use client";

export default function DebtCardPaydayNotice(props: { daysUntilPayday: number }) {
	const { daysUntilPayday } = props;

	return (
		<div className="mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg w-fit">
			<div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-500 rounded-full animate-pulse" />
			<span className="text-[10px] sm:text-xs font-semibold text-amber-400">
				{daysUntilPayday === 0
					? "PAYDAY - Payment Due Today"
					: `Payment Due in ${daysUntilPayday} day${daysUntilPayday > 1 ? "s" : ""}`}
			</span>
		</div>
	);
}
