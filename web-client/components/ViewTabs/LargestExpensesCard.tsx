import { Card, InfoTooltip } from "@/components/Shared";
import Currency from "@/components/ViewTabs/Currency";
import type { LargestExpensesCardModel } from "@/types";

export default function LargestExpensesCard(props: {
	model: LargestExpensesCardModel;
	totalDebtBalance: number;
	goalsCount: number;
}) {
	const { model, totalDebtBalance, goalsCount } = props;

	return (
		<Card title={undefined} className="lg:col-span-5">
			<div className="space-y-3">
				<div className="inline-flex">
					<div className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900" style={{ backgroundColor: "#9EDBFF" }}>
						{model.title}
					</div>
				</div>

				{model.sections.length > 0 ? (
					<div className="space-y-3">
						{model.sections.map((section, idx) => {
							const prev = model.sections[idx - 1];
							const shouldDividerBetweenEventPlans =
								model.showEventDivider &&
								prev &&
								((prev.key === "carnival" && section.key === "holiday") ||
									(prev.key === "holiday" && section.key === "carnival"));
							return (
								<div key={section.key} className="space-y-2">
									{shouldDividerBetweenEventPlans ? <div className="h-px bg-white/10" /> : null}
									<div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{section.label}</div>
									{section.items.map((e) => (
										<div key={e.id} className="flex items-center justify-between gap-3">
											<div className="text-sm text-white truncate">{e.name}</div>
											<div className="text-sm text-slate-200 whitespace-nowrap">
												<Currency value={e.amount} />
											</div>
										</div>
									))}
								</div>
							);
						})}
					</div>
				) : model.flat.length === 0 ? (
					<div className="text-sm text-slate-300">No expenses yet for this month.</div>
				) : (
					<div className="space-y-2">
						{model.flat.map((e) => (
							<div key={e.id} className="flex items-center justify-between gap-3">
								<div className="text-sm text-white truncate">{e.name}</div>
								<div className="text-sm text-slate-200 whitespace-nowrap">
									<Currency value={e.amount} />
								</div>
							</div>
						))}
					</div>
				)}

				<div className="grid grid-cols-2 gap-2">
					<Card
						title={
							<span className="inline-flex items-center gap-1.5">
								Debt
								<InfoTooltip
									ariaLabel="Debt total info"
									content="Sum of your current outstanding debt balances for this plan (excluding fully paid debts)."
								/>
							</span>
						}
						className="p-3 bg-white/5"
					>
						<div className="text-base font-bold">
							<Currency value={totalDebtBalance} />
						</div>
						<div className="text-xs text-slate-300">this plan</div>
					</Card>
					<Card
						title={
							<span className="inline-flex items-center gap-1.5">
								Goals
								<InfoTooltip
									ariaLabel="Goals count info"
									content="Number of active goals on this plan (excluding the special 'Pay Back Debts' goal)."
								/>
							</span>
						}
						className="p-3 bg-white/5"
					>
						<div className="text-base font-bold">{goalsCount}</div>
						<div className="text-xs text-slate-300">active</div>
					</Card>
				</div>
			</div>
		</Card>
	);
}
