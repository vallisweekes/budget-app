import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { buildPayPeriodFromMonthAnchor, type PayFrequency } from "@/lib/payPeriods";

export const OVERDUE_GRACE_DAYS = 5;

function toLocalDateOnly(value: Date): Date {
	return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function resolveExpenseDueDate(params: {
	year: number;
	month: number;
	dueDate: Date | null;
	defaultDueDay: number;
}): Date {
	const { year, month, dueDate, defaultDueDay } = params;
	if (dueDate) return toLocalDateOnly(dueDate);
	return new Date(year, month - 1, defaultDueDay);
}

export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

export function resolveExpenseOverdueThresholdDate(params: {
	year: number;
	month: number;
	dueDate: Date | null;
	payDate: number;
	payFrequency: PayFrequency;
	payAnchorDate?: Date | string | null;
	graceDays?: number;
}): Date {
	const periodWindow = buildPayPeriodFromMonthAnchor({
		anchorYear: params.year,
		anchorMonth: params.month,
		payDate: params.payDate,
		payFrequency: params.payFrequency,
		payAnchorDate: params.payAnchorDate,
	});

	const periodEnd = toLocalDateOnly(periodWindow.end);
	const explicitDueDate = params.dueDate ? toLocalDateOnly(params.dueDate) : null;
	const baseDate = explicitDueDate && explicitDueDate.getTime() > periodEnd.getTime()
		? explicitDueDate
		: periodEnd;

	return addDays(baseDate, params.graceDays ?? OVERDUE_GRACE_DAYS);
}

export { monthNumberToKey };
