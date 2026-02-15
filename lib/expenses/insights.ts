import type { ExpenseItem, PaymentStatus } from "@/types";
import { formatMonthKeyLabel, monthNumberToKey } from "@/lib/helpers/monthKey";

export type ExpenseUrgency = "overdue" | "today" | "soon" | "later";

export interface PreviousMonthRecap {
	label: string;
	totalCount: number;
	totalAmount: number;
	paidCount: number;
	paidAmount: number;
	partialCount: number;
	partialAmount: number;
	unpaidCount: number;
	unpaidAmount: number;
	missedDueCount: number;
	missedDueAmount: number;
}

export interface UpcomingPayment {
	id: string;
	name: string;
	amount: number;
	paidAmount: number;
	status: PaymentStatus;
	dueDate: string; // ISO YYYY-MM-DD
	daysUntilDue: number;
	urgency: ExpenseUrgency;
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function isoFromYmd(year: number, monthNum: number, day: number): string {
	return `${year}-${pad2(monthNum)}-${pad2(day)}`;
}

function daysInMonthUtc(year: number, monthIndex0: number): number {
	return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function parseIsoDateToUtcDateOnly(iso: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
	const [y, m, d] = iso.split("-").map((x) => Number(x));
	if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
	return new Date(Date.UTC(y, m - 1, d));
}

function todayUtcDateOnly(now: Date = new Date()): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function diffDaysUtc(a: Date, b: Date): number {
	const ms = 24 * 60 * 60 * 1000;
	return Math.round((a.getTime() - b.getTime()) / ms);
}

function toFiniteNumber(value: unknown): number {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

export function getPaymentStatus(expense: ExpenseItem): PaymentStatus {
	const amount = toFiniteNumber(expense.amount);
	const paidAmount = toFiniteNumber(expense.paidAmount);
	if (expense.paid || (amount > 0 && paidAmount >= amount)) return "paid";
	if (paidAmount > 0) return "partial";
	return "unpaid";
}

export function resolveEffectiveDueDateIso(
	expense: ExpenseItem,
	ctx: { year: number; monthNum: number; payDate: number }
): string | null {
	if (expense.dueDate) return expense.dueDate;
	const year = ctx.year;
	const monthNum = ctx.monthNum;
	const payDate = toFiniteNumber(ctx.payDate);
	if (!Number.isFinite(year) || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return null;
	if (!Number.isFinite(payDate) || payDate < 1) return null;
	const maxDay = daysInMonthUtc(year, monthNum - 1);
	const clampedDay = Math.min(Math.max(1, Math.floor(payDate)), maxDay);
	return isoFromYmd(year, monthNum, clampedDay);
}

export function computePreviousMonthRecap(
	expenses: ExpenseItem[],
	ctx: { year: number; monthNum: number; payDate: number; now?: Date }
): PreviousMonthRecap {
	const monthKey = monthNumberToKey(ctx.monthNum);
	const label = `${formatMonthKeyLabel(monthKey)} ${ctx.year}`;

	const endOfMonth = new Date(Date.UTC(ctx.year, ctx.monthNum, 0)); // last day of month

	let totalCount = 0;
	let totalAmount = 0;
	let paidCount = 0;
	let paidAmount = 0;
	let partialCount = 0;
	let partialAmount = 0;
	let unpaidCount = 0;
	let unpaidAmount = 0;
	let missedDueCount = 0;
	let missedDueAmount = 0;

	for (const e of expenses) {
		const amount = toFiniteNumber(e.amount);
		if (!(amount > 0)) continue;

		const paidAmt = toFiniteNumber(e.paidAmount);
		const status = getPaymentStatus(e);
		const dueIso = resolveEffectiveDueDateIso(e, ctx);
		const due = dueIso ? parseIsoDateToUtcDateOnly(dueIso) : null;
		const dueByEndOfMonth = due ? due.getTime() <= endOfMonth.getTime() : true;

		totalCount += 1;
		totalAmount += amount;

		if (status === "paid") {
			paidCount += 1;
			paidAmount += amount;
			continue;
		}

		if (status === "partial") {
			partialCount += 1;
			partialAmount += Math.max(0, amount - paidAmt);
		} else {
			unpaidCount += 1;
			unpaidAmount += amount;
		}

		if (dueByEndOfMonth) {
			missedDueCount += 1;
			missedDueAmount += Math.max(0, amount - paidAmt);
		}
	}

	return {
		label,
		totalCount,
		totalAmount,
		paidCount,
		paidAmount,
		partialCount,
		partialAmount,
		unpaidCount,
		unpaidAmount,
		missedDueCount,
		missedDueAmount,
	};
}

export function computeUpcomingPayments(
	expenses: ExpenseItem[],
	ctx: { year: number; monthNum: number; payDate: number; now?: Date; limit?: number }
): UpcomingPayment[] {
	const today = todayUtcDateOnly(ctx.now);
	const limit = ctx.limit ?? 6;

	const upcoming: UpcomingPayment[] = [];

	for (const e of expenses) {
		const amount = toFiniteNumber(e.amount);
		if (!(amount > 0)) continue;

		const paidAmt = toFiniteNumber(e.paidAmount);
		const status = getPaymentStatus(e);
		const dueIso = resolveEffectiveDueDateIso(e, ctx);
		if (!dueIso) continue;
		const due = parseIsoDateToUtcDateOnly(dueIso);
		if (!due) continue;

		const daysUntilDue = diffDaysUtc(due, today);

		let urgency: ExpenseUrgency = "later";
		if (status !== "paid") {
			if (daysUntilDue < 0) urgency = "overdue";
			else if (daysUntilDue === 0) urgency = "today";
			else if (daysUntilDue <= 7) urgency = "soon";
		}

		upcoming.push({
			id: e.id,
			name: e.name,
			amount,
			paidAmount: paidAmt,
			status,
			dueDate: dueIso,
			daysUntilDue,
			urgency,
		});
	}

	const score = (u: UpcomingPayment): number => {
		// Lower score sorts earlier.
		if (u.status === "paid") return 10000 + u.daysUntilDue;
		switch (u.urgency) {
			case "overdue":
				return -1000 + u.daysUntilDue;
			case "today":
				return -500;
			case "soon":
				return u.daysUntilDue;
			default:
				return 100 + u.daysUntilDue;
		}
	};

	return upcoming
		.sort((a, b) => score(a) - score(b))
		.slice(0, Math.max(0, limit));
}
