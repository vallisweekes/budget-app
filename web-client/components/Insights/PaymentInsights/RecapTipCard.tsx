import type { RecapTip } from "@/lib/expenses/insights";
import { Card } from "@/components/Shared";

export default function RecapTipCard({ tip, colClass }: { tip: RecapTip; colClass: string }) {
	const isHighPriorityTip = Number(tip?.priority ?? 0) >= 80;

	return (
		<Card title={undefined} className={colClass}>
			<div className="h-full flex flex-col justify-center">
				<div>
					<div className="flex items-center gap-2">
						<div className="text-xs uppercase tracking-wide text-slate-400">Tip</div>
						{isHighPriorityTip ? (
							<span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
								High priority
							</span>
						) : null}
					</div>
					<div className="mt-1 text-sm font-semibold text-white">{tip.title}</div>
					<div className="mt-0.5 text-xs text-slate-300">{tip.detail}</div>
				</div>
			</div>
		</Card>
	);
}
