import type { PreviousMonthRecap } from "@/lib/expenses/insights";
import { Card, PillLabel } from "@/components/Shared";
import { formatCurrency } from "@/lib/helpers/money";
import { badgeClass, toTitleCaseMonthOnly } from "@/lib/helpers/insights/paymentInsights";

function money(value: number): string {
	return formatCurrency(Number.isFinite(value) ? value : 0);
}

export default function RecapCard({
	recap,
	fullWidth,
	title,
}: {
	recap: PreviousMonthRecap;
	fullWidth: boolean;
	title?: string;
}) {
	return (
		<Card title={undefined} className={fullWidth ? "lg:col-span-12" : "lg:col-span-6 lg:row-start-1"}>
			<div className="space-y-2">
				<PillLabel>{title && title.trim().length > 0 ? title : `${toTitleCaseMonthOnly(recap.label)} Recap`}</PillLabel>
				<div className="grid grid-cols-2 gap-2">
					<div className={`rounded-2xl border p-2.5 ${badgeClass("ok")}`}>
						<div className="text-xs uppercase tracking-wide opacity-90">Paid</div>
						<div className="mt-1 text-base font-bold">{recap.paidCount}</div>
						<div className="text-sm font-semibold opacity-90">{money(recap.paidAmount)}</div>
					</div>
					<div
						className={`rounded-2xl border p-2.5 ${badgeClass(recap.missedDueCount > 0 ? "bad" : "muted")}`}
					>
						<div className="text-xs uppercase tracking-wide opacity-90">Missed payment</div>
						<div className="mt-1 text-base font-bold">{recap.missedDueCount}</div>
						<div className="text-sm font-semibold opacity-90">{money(recap.missedDueAmount)}</div>
					</div>
				</div>
			</div>
		</Card>
	);
}
