import type { MonthKey } from "@/types";

import { monthKeyToNumber } from "@/lib/helpers/monthKey";
import { daysUntilUtc, formatDueDateLabel, getDueDateUtc } from "@/lib/helpers/expenses/dueDate";

export function getExpenseDuePreviewMeta({
	paid,
	dueDate,
	month,
	year,
	payDate,
}: {
	paid?: boolean;
	dueDate?: string;
	month: MonthKey;
	year: number;
	payDate: number;
}): { label: string; colorClass: string } {
	if (paid) return { label: "Paid", colorClass: "text-emerald-400" };

	const monthNumber = monthKeyToNumber(month);
	const dueDateUtc = getDueDateUtc({ year, monthNumber, dueDate, payDate });
	const days = daysUntilUtc(dueDateUtc);
	const label = formatDueDateLabel(days, dueDateUtc);

	const colorClass = days <= 0 ? "text-red-300" : days <= 5 ? "text-orange-300" : "text-slate-400";
	return { label, colorClass };
}
