import type { ExpenseItem, PaymentStatus } from "@/types";
import { formatMonthKeyLabel, monthNumberToKey } from "@/lib/helpers/monthKey";
import { formatCurrency } from "@/lib/helpers/money";

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

export interface RecapTip {
	title: string;
	detail: string;
	priority?: number;
}

function clampPriority(value: number): number {
	if (!Number.isFinite(value)) return 1;
	return Math.max(1, Math.min(100, Math.round(value)));
}

function inferTipPriority(tip: RecapTip): number {
	if (Number.isFinite(tip.priority)) return clampPriority(Number(tip.priority));

	const text = `${tip.title} ${tip.detail}`.toLowerCase();
	let score = 45;

	if (/(overdue|late fee|missed|over limit|minimum payment|due within 7 days|due today|negative gap|short by)/.test(text)) score += 34;
	if (/(debt|apr|interest|pay down|minimum|credit)/.test(text)) score += 14;
	if (/(save|savings|buffer|set aside|autopay|reminder)/.test(text)) score += 8;
	if (/(today|now|this week|within 7 days|first)/.test(text)) score += 6;

	return clampPriority(score);
}

export function prioritizeRecapTips(tips: RecapTip[], limit?: number): RecapTip[] {
	if (!Array.isArray(tips) || tips.length === 0) return [];

	const ranked = tips
		.map((tip, index) => ({
			index,
			tip: {
				...tip,
				priority: inferTipPriority(tip),
			},
		}))
		.sort((a, b) => (b.tip.priority ?? 0) - (a.tip.priority ?? 0) || a.index - b.index)
		.map((entry) => entry.tip);

	if (!Number.isFinite(limit)) return ranked;
	return ranked.slice(0, Math.max(0, Number(limit)));
}

export type DatedExpenseItem = ExpenseItem & { year: number; monthNum: number };

export interface UpcomingPayment {
	id: string;
	kind: "expense" | "debt" | "allocation";
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

function dayOfMonthFromIso(iso: string): number | null {
	if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(iso)) return null;
	const day = Number(iso.slice(8, 10));
	return Number.isFinite(day) && day >= 1 && day <= 31 ? day : null;
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

function monthLabel(year: number, monthNum: number): string {
	const monthKey = monthNumberToKey(monthNum);
	return `${formatMonthKeyLabel(monthKey)} ${year}`;
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
			kind: "expense",
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

export function computeRecapTips(args: {
	recap: PreviousMonthRecap;
	currentMonthExpenses: ExpenseItem[];
	ctx: { year: number; monthNum: number; payDate: number; now?: Date };
	forecasts?: Array<{ year: number; monthNum: number; incomeTotal: number; billsTotal: number }>;
	historyExpenses?: DatedExpenseItem[];
}): RecapTip[] {
	const tips: RecapTip[] = [];
	const now = args.ctx.now ?? new Date();
	const today = todayUtcDateOnly(now);

	const needsHelp = args.recap.missedDueCount > 0 || args.recap.unpaidCount + args.recap.partialCount > 0;
	if (!needsHelp) return tips;

	// Personalization based on the user's recent patterns (this plan's history).
	const history = Array.isArray(args.historyExpenses) ? args.historyExpenses : [];
	if (history.length > 0) {
		const monthsInHistory = new Set(history.map((h) => `${h.year}-${h.monthNum}`)).size;

		// Compute which bills are most frequently missed.
		const missedByName = new Map<string, { count: number; totalRemaining: number }>();
		let partialCount = 0;
		let notPaidCount = 0;
		let dueBeforePayDateCount = 0;
		let dueWithKnownDayCount = 0;

		for (const e of history) {
			const amount = toFiniteNumber(e.amount);
			if (!(amount > 0)) continue;

			const paidAmount = toFiniteNumber(e.paidAmount);
			const status = getPaymentStatus(e);
			if (status !== "paid") notPaidCount += 1;
			if (status === "partial") partialCount += 1;

			const dueIso = resolveEffectiveDueDateIso(e, { year: e.year, monthNum: e.monthNum, payDate: args.ctx.payDate });
			if (dueIso) {
				const dueDay = dayOfMonthFromIso(dueIso);
				if (dueDay != null) {
					dueWithKnownDayCount += 1;
					if (dueDay < Math.floor(args.ctx.payDate)) dueBeforePayDateCount += 1;
				}
			}

			// Missed = unpaid/partial where due date is by month end.
			if (status === "paid") continue;
			const endOfMonth = new Date(Date.UTC(e.year, e.monthNum, 0));
			const due = dueIso ? parseIsoDateToUtcDateOnly(dueIso) : null;
			const dueByEndOfMonth = due ? due.getTime() <= endOfMonth.getTime() : true;
			if (!dueByEndOfMonth) continue;

			const key = (e.name || "").trim() || "(Unnamed bill)";
			const prev = missedByName.get(key) ?? { count: 0, totalRemaining: 0 };
			missedByName.set(key, {
				count: prev.count + 1,
				totalRemaining: prev.totalRemaining + Math.max(0, amount - paidAmount),
			});
		}

		const topMissed = Array.from(missedByName.entries())
			.sort((a, b) => b[1].count - a[1].count || b[1].totalRemaining - a[1].totalRemaining)
			.slice(0, 1);

		if (topMissed.length > 0 && topMissed[0][1].count >= 2 && monthsInHistory >= 2) {
			const [name, stat] = topMissed[0];
			tips.push({
				title: `You often miss ${name}`,
				detail: `${name} was missed ${stat.count} times in your recent history. Consider autopay (if available) or a recurring reminder 3 days before the due date.`,
			});
		}

		if (dueWithKnownDayCount >= 6) {
			const ratio = dueBeforePayDateCount / Math.max(1, dueWithKnownDayCount);
			if (ratio >= 0.6) {
				tips.push({
					title: "Many bills are due before payday",
					detail: "A lot of your bills fall before your pay date. If possible, move due dates to just after payday or set a ‘bills pot’ transfer on payday to cover them.",
				});
			}
		}

		if (notPaidCount >= 4) {
			const ratio = partialCount / Math.max(1, notPaidCount);
			if (ratio >= 0.5) {
				tips.push({
					title: "You often pay partially",
					detail: "If partial payments are common, try splitting large bills into 2 payments (payday + mid-month) so they don’t pile up near the due date.",
				});
			}
		}
	}

	let overdueRemaining = 0;
	for (const e of args.currentMonthExpenses) {
		const amount = toFiniteNumber(e.amount);
		if (!(amount > 0)) continue;
		const paidAmount = toFiniteNumber(e.paidAmount);
		const status = getPaymentStatus(e);
		if (status === "paid") continue;

		const dueIso = resolveEffectiveDueDateIso(e, args.ctx);
		if (!dueIso) continue;
		const due = parseIsoDateToUtcDateOnly(dueIso);
		if (!due) continue;

		const daysUntil = diffDaysUtc(due, today);
		if (daysUntil < 0) overdueRemaining += Math.max(0, amount - paidAmount);
	}

	if (overdueRemaining > 0) {
		tips.push({
			title: "Prioritize overdue bills first",
			detail: `Start with anything overdue. Even partial payments help reduce late fees. Remaining overdue: ${formatCurrency(overdueRemaining)}.`,
		});
	}

	tips.push({
		title: "Pay on payday (or the day after)",
		detail: "If possible, schedule bill payments right after your pay date so you don’t accidentally spend it elsewhere.",
	});

	tips.push({
		title: "Add reminders + autopay for the basics",
		detail: "Turn on reminders 3 days before due dates (and on the day). Use autopay for rent/mortgage/utilities if you can.",
	});

	tips.push({
		title: "Build a tiny ‘bills buffer’",
		detail: "Aim for a small buffer (even £25–£50) so one unexpected spend doesn’t cause a missed bill.",
	});

	const forecasts = args.forecasts ?? [];
	if (forecasts.length > 0) {
		const byKey = new Map<string, { incomeTotal: number; billsTotal: number }>();
		for (const f of forecasts) {
			byKey.set(`${f.year}-${f.monthNum}`, {
				incomeTotal: toFiniteNumber(f.incomeTotal),
				billsTotal: toFiniteNumber(f.billsTotal),
			});
		}

		const currentKey = `${args.ctx.year}-${args.ctx.monthNum}`;
		const current = byKey.get(currentKey);
		const currentNet = current ? current.incomeTotal - current.billsTotal : 0;

		let best: { year: number; monthNum: number; net: number } | null = null;
		let tight: { year: number; monthNum: number; net: number } | null = null;
		for (const f of forecasts) {
			if (f.year === args.ctx.year && f.monthNum === args.ctx.monthNum) continue;
			const net = toFiniteNumber(f.incomeTotal) - toFiniteNumber(f.billsTotal);
			if (!best || net > best.net) best = { year: f.year, monthNum: f.monthNum, net };
			if (!tight || net < tight.net) tight = { year: f.year, monthNum: f.monthNum, net };
		}

		if (best && best.net > currentNet + 50 && (overdueRemaining > 0 || args.recap.missedDueAmount > 0)) {
			const headroom = Math.max(0, best.net - currentNet);
			const suggestedExtra = Math.max(0, Math.min(overdueRemaining || args.recap.missedDueAmount, headroom));
			tips.push({
				title: "Use higher-income months to catch up",
				detail: `${monthLabel(best.year, best.monthNum)} looks stronger after bills (about ${formatCurrency(headroom)} more than this month). If you can, consider paying an extra ~${formatCurrency(suggestedExtra)} toward overdue/missed bills then.`,
			});
		}

		if (tight && tight.net < 0) {
			tips.push({
				title: "Watch for tight months ahead",
				detail: `${monthLabel(tight.year, tight.monthNum)} projects a negative gap after bills. Consider pre-paying 1–2 smaller bills in the prior month or trimming discretionary spend early.`,
			});
		}
	}

	return prioritizeRecapTips(tips);
}
