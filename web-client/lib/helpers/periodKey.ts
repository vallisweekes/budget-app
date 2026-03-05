/**
 * Pay-period key utility.
 *
 * `periodKey` is an ISO date string ("YYYY-MM-DD") of the period's START date
 * (the user's payday that opens the period).
 *
 * Example: payDate = 27
 *   Feb 27 – Mar 26 → periodKey = "2026-02-27"
 *   Mar 27 – Apr 26 → periodKey = "2026-03-27"
 *
 * A date that falls ON the payDate belongs to the period starting that day.
 * A date before the payDate belongs to the period that started on the
 * previous month's payDate.
 */

/**
 * Clamp a day to the valid range for the given year/month (0-indexed).
 */
function clampDay(year: number, month0: number, day: number): number {
	const maxDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
	return Math.max(1, Math.min(maxDay, Math.floor(day)));
}

/**
 * Given a reference date and the user's payday, return the periodKey
 * (ISO date string of the period start).
 *
 * @param date  The date to classify (e.g. an expense dueDate or payment paidAt)
 * @param payDate  The day-of-month the user gets paid (e.g. 27)
 */
export function getPeriodKey(date: Date, payDate: number): string {
	const safePayDate = Number.isFinite(payDate) && payDate >= 1 ? Math.floor(payDate) : 1;
	const y = date.getUTCFullYear();
	const m = date.getUTCMonth(); // 0-indexed
	const d = date.getUTCDate();

	const clampedPayDay = clampDay(y, m, safePayDate);

	if (d >= clampedPayDay) {
		// Date is on or after payday this month → period starts this month
		const startDay = clampDay(y, m, safePayDate);
		const start = new Date(Date.UTC(y, m, startDay));
		return start.toISOString().slice(0, 10);
	} else {
		// Date is before payday this month → period started last month
		const prevDate = new Date(Date.UTC(y, m - 1, 1)); // handles year rollover
		const py = prevDate.getUTCFullYear();
		const pm = prevDate.getUTCMonth();
		const startDay = clampDay(py, pm, safePayDate);
		const start = new Date(Date.UTC(py, pm, startDay));
		return start.toISOString().slice(0, 10);
	}
}

/**
 * Build the periodKey for the *current* pay period (based on `now`).
 */
export function getCurrentPeriodKey(payDate: number, now?: Date): string {
	return getPeriodKey(now ?? new Date(), payDate);
}

/**
 * Get the period start and end dates from a periodKey string.
 */
export function parsePeriodKeyRange(periodKey: string, payDate: number): { start: Date; end: Date } {
	const start = new Date(periodKey + "T00:00:00.000Z");
	if (!Number.isFinite(start.getTime())) {
		throw new Error(`Invalid periodKey: "${periodKey}"`);
	}

	const safePayDate = Number.isFinite(payDate) && payDate >= 1 ? Math.floor(payDate) : 1;

	// End date = day before next payday
	const y = start.getUTCFullYear();
	const m = start.getUTCMonth();
	const nextMonth = new Date(Date.UTC(y, m + 1, 1));
	const ny = nextMonth.getUTCFullYear();
	const nm = nextMonth.getUTCMonth();
	const nextPayDay = clampDay(ny, nm, safePayDate);
	const end = new Date(Date.UTC(ny, nm, nextPayDay - 1, 23, 59, 59, 999));

	return { start, end };
}

/**
 * Get the period key for an expense based on its dueDate (preferred) or year/month + payDate fallback.
 */
export function getExpensePeriodKey(expense: { dueDate?: Date | string | null; year: number; month: number }, payDate: number): string {
	if (expense.dueDate) {
		const due = typeof expense.dueDate === "string" ? new Date(expense.dueDate) : expense.dueDate;
		if (Number.isFinite(due.getTime())) {
			return getPeriodKey(due, payDate);
		}
	}
	// Fallback: assume the expense is due on the payDate of its month
	const safePayDate = Number.isFinite(payDate) && payDate >= 1 ? Math.floor(payDate) : 1;
	const m0 = expense.month - 1; // 0-indexed
	const day = clampDay(expense.year, m0, safePayDate);
	const fallbackDate = new Date(Date.UTC(expense.year, m0, day));
	return getPeriodKey(fallbackDate, payDate);
}

/**
 * Get the period key for a payment (debt or expense payment) based on its paidAt date.
 */
export function getPaymentPeriodKey(paidAt: Date, payDate: number): string {
	return getPeriodKey(paidAt, payDate);
}

/**
 * Get the period key for an income record based on its year/month.
 * Income for month M belongs to the period starting on payDate of month M.
 */
export function getIncomePeriodKey(income: { year: number; month: number }, payDate: number): string {
	const safePayDate = Number.isFinite(payDate) && payDate >= 1 ? Math.floor(payDate) : 1;
	const m0 = income.month - 1;
	const day = clampDay(income.year, m0, safePayDate);
	return new Date(Date.UTC(income.year, m0, day)).toISOString().slice(0, 10);
}

// ─── Prisma helper: resolve payDate from budgetPlan ────────────────────
import { prisma } from "@/lib/prisma";

const _cache = new Map<string, number>();

/**
 * Resolve the user's payDate from a budgetPlanId.
 * Caches in-memory within the same server process lifetime (payDate rarely changes).
 */
export async function resolvePayDate(budgetPlanId: string): Promise<number> {
	const cached = _cache.get(budgetPlanId);
	if (cached !== undefined) return cached;
	const plan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true },
	});
	const payDate = Number(plan?.payDate ?? 27);
	_cache.set(budgetPlanId, payDate);
	return payDate;
}

/**
 * Invalidate the cached payDate (call when payDate is updated).
 */
export function invalidatePayDateCache(budgetPlanId?: string): void {
	if (budgetPlanId) _cache.delete(budgetPlanId);
	else _cache.clear();
}
