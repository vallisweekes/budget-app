import type { UpcomingPayment } from "@/lib/expenses/insights";
import { Card, PillLabel } from "@/components/Shared";
import { formatCurrency } from "@/lib/helpers/money";
import { badgeClass, dotClass, dueLabel, normalizeUpcomingName, urgencyTone } from "@/lib/helpers/insights/paymentInsights";

function money(value: number): string {
	return formatCurrency(Number.isFinite(value) ? value : 0);
}

export default function UpcomingPaymentsCard({
	upcoming,
	colClass,
}: {
	upcoming?: UpcomingPayment[] | null;
	colClass: string;
}) {
	return (
		<Card title={undefined} className={colClass}>
			{!upcoming || upcoming.length === 0 ? (
				<div className="space-y-3">
					<PillLabel>Upcoming payments</PillLabel>
					<div className="text-sm text-slate-300">Nothing urgent right now.</div>
				</div>
			) : (
				<div className="space-y-2">
					<PillLabel>Upcoming payments</PillLabel>
					{upcoming.map((u) => {
						const tagTone = urgencyTone(u.urgency);
						const isDebt = u.id.startsWith("debt:") || u.id.startsWith("debt-expense:");
						const isMissPaymentDebt = u.id.startsWith("debt-expense:");
						const displayName = normalizeUpcomingName(u.name);
						return (
							<div
								key={u.id}
								className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2 text-slate-200"
							>
								<div className="min-w-0">
									<div className="inline-flex items-center gap-1 min-w-0">
										<span aria-hidden className={`h-1 w-1 rounded-full shrink-0 ${dotClass(tagTone)}`} />
										<div className="text-[12px] leading-none font-semibold truncate">{displayName}</div>
									</div>
									<div className="mt-1 flex items-center gap-2">
										<div
											className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[8px] font-semibold ${badgeClass(
												tagTone
											)}`}
											title={
												u.urgency === "overdue"
													? "Overdue payment"
												: u.urgency === "today"
													? "Payment due today"
												: u.urgency === "soon"
													? "Payment due soon"
													: "Upcoming payment"
											}
										>
											{dueLabel(u)}
										</div>
										{isDebt ? (
											<div className="inline-flex items-center rounded-md border border-white/10 bg-slate-950/40 px-2 py-0.5 text-[8px] font-semibold text-slate-200">
												{isMissPaymentDebt ? "Miss Payment Debt" : "Debt"}
											</div>
										) : null}
									</div>
								</div>
								<div className="text-right whitespace-nowrap">
									<div className="text-sm font-bold">{money(u.amount)}</div>
									{u.status !== "paid" ? (
										<div className="text-xs text-slate-300">
											Remaining {money(Math.max(0, u.amount - u.paidAmount))}
										</div>
									) : (
										<div className="text-xs text-slate-300">Paid</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</Card>
	);
}
