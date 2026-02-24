import { monthNumberToKey } from "@/lib/helpers/monthKey";

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

export { monthNumberToKey };
