import { getPayPeriodKeyForDate, getPayPeriodWindowFromPeriodKey, normalizePayFrequency, type PayFrequency } from "@/lib/payPeriods";

export type DebtPayoffProjection = {
	computedMonthlyPayment: number;
	computedMonthsLeft: number | null;
	computedPaidOffBy: string | null;
};

export type ScheduledDebtPaymentOverride = {
	periodKey: string;
	amount: number;
};

function startOfLocalDay(date: Date): Date {
	const out = new Date(date.getTime());
	out.setHours(0, 0, 0, 0);
	return out;
}

function clampDayToMonth(year: number, monthIndex: number, day: number): Date {
	const lastDay = new Date(year, monthIndex + 1, 0).getDate();
	const clamped = Math.min(Math.max(1, Math.trunc(day)), lastDay);
	return new Date(year, monthIndex, clamped);
}

function clampDayToUtcMonth(year: number, monthIndex: number, day: number): Date {
	const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
	const clamped = Math.min(Math.max(1, Math.trunc(day)), lastDay);
	return new Date(Date.UTC(year, monthIndex, clamped));
}

function toDate(value: unknown): Date | null {
	if (value == null) return null;
	if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
	if (typeof value === "string" || typeof value === "number") {
		const parsed = new Date(value as any);
		return Number.isFinite(parsed.getTime()) ? parsed : null;
	}
	if (typeof value === "object" && value && "toString" in value && typeof (value as any).toString === "function") {
		const parsed = new Date((value as any).toString());
		return Number.isFinite(parsed.getTime()) ? parsed : null;
	}
	return null;
}

function startOfUtcDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
	const next = new Date(date.getTime());
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function diffCalendarMonthsCeil(from: Date, to: Date): number {
	const msPerDay = 24 * 60 * 60 * 1000;
	const diffDays = Math.max(0, Math.ceil((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / msPerDay));
	return Math.max(0, Math.ceil(diffDays / 30.4375));
}

function resolveProjectionReferenceDate(params: { now: Date; dueDate: unknown; dueDay: unknown }): Date {
	const now = startOfLocalDay(params.now);
	const parsedDueDate = toDate(params.dueDate);
	if (parsedDueDate) {
		const due = startOfLocalDay(parsedDueDate);
		return due >= now ? due : now;
	}

	const rawDueDay = clampNumber(params.dueDay);
	const dueDay = Number.isFinite(rawDueDay) ? Math.trunc(rawDueDay) : 0;
	if (dueDay >= 1 && dueDay <= 31) {
		const thisMonthDue = startOfLocalDay(clampDayToMonth(now.getFullYear(), now.getMonth(), dueDay));
		if (thisMonthDue >= now) return thisMonthDue;
		return startOfLocalDay(clampDayToMonth(now.getFullYear(), now.getMonth() + 1, dueDay));
	}

	return now;
}

function resolveProjectionAnchorPeriodKey(params: {
	now: Date;
	dueDate: unknown;
	dueDay: unknown;
	payDate: number;
	payFrequency: PayFrequency;
}): string {
	const referenceDate = resolveProjectionReferenceDate({
		now: params.now,
		dueDate: params.dueDate,
		dueDay: params.dueDay,
	});

	return getPayPeriodKeyForDate({
		date: startOfUtcDay(referenceDate),
		payDate: params.payDate,
		payFrequency: params.payFrequency,
	});
}

function getNextPeriodKey(params: {
	periodKey: string;
	payDate: number;
	payFrequency: PayFrequency;
}): string {
	const { end } = getPayPeriodWindowFromPeriodKey({
		periodKey: params.periodKey,
		payDate: params.payDate,
		payFrequency: params.payFrequency,
	});
	return getPayPeriodKeyForDate({
		date: addUtcDays(end, 1),
		payDate: params.payDate,
		payFrequency: params.payFrequency,
	});
}

function buildProjection(params: {
	balance: number;
	monthlyPayment: number;
	periodRate: number;
	maxMonths: number;
	anchorPeriodKey: string;
	payDate: number;
	payFrequency: PayFrequency;
	scheduledOverrides?: ScheduledDebtPaymentOverride[];
}): { points: number[]; lastPaymentDate: Date | null } {
	const points: number[] = [params.balance];
	let current = params.balance;
	let lastPaymentDate: Date | null = null;
	const overrideMap = new Map(
		(params.scheduledOverrides ?? [])
			.filter((override) => typeof override.periodKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(override.periodKey))
			.map((override) => [
				override.periodKey,
				Math.max(0, clampNumber(override.amount)),
			]),
	);
	let periodKey = params.anchorPeriodKey;

	for (let index = 0; index < params.maxMonths; index += 1) {
		if (current <= 0) break;
		const { start } = getPayPeriodWindowFromPeriodKey({
			periodKey,
			payDate: params.payDate,
			payFrequency: params.payFrequency,
		});
		const scheduledPayment = overrideMap.get(periodKey);
		const paymentAmount = typeof scheduledPayment === "number"
			? scheduledPayment
			: params.monthlyPayment;
		current = params.periodRate > 0 ? current * (1 + params.periodRate) - paymentAmount : current - paymentAmount;
		current = Math.max(0, current);
		points.push(current);
		lastPaymentDate = start;
		if (current === 0) break;
		periodKey = getNextPeriodKey({
			periodKey,
			payDate: params.payDate,
			payFrequency: params.payFrequency,
		});
	}

	return { points, lastPaymentDate };
}

function clampNumber(value: unknown): number {
	if (typeof value === "number") return value;
	if (typeof value === "string") return Number(value);
	if (value && typeof value === "object" && "toString" in value && typeof (value as any).toString === "function") {
		return Number((value as any).toString());
	}
	return Number(value as any);
}

export function computeDebtPayoffProjection(params: {
	currentBalance: unknown;
	plannedMonthlyPayment: unknown;
	monthlyMinimum: unknown;
	installmentMonths: unknown;
	initialBalance: unknown;
	interestRatePct: unknown;
	dueDate?: unknown;
	dueDay?: unknown;
	payDate?: unknown;
	payFrequency?: unknown;
	/** When provided, credit_card / store_card uses monthlyMinimum as the planned payment */
	debtType?: string;
	plannedPaymentOverrides?: ScheduledDebtPaymentOverride[];
	maxMonths?: number;
	now?: Date;
}): DebtPayoffProjection {
	const maxMonths = Number.isFinite(params.maxMonths) ? (params.maxMonths as number) : 60;
	const now = params.now ?? new Date();

	const currentBalance = Math.max(0, clampNumber(params.currentBalance));
	const initialBalance = Math.max(0, clampNumber(params.initialBalance));
	const installmentMonthsRaw = clampNumber(params.installmentMonths);
	const installmentMonths = Number.isFinite(installmentMonthsRaw) ? Math.trunc(installmentMonthsRaw) : 0;

	let planned = clampNumber(params.plannedMonthlyPayment);
	planned = Number.isFinite(planned) ? planned : 0;

	// `amount` is the planned monthly payment when present.
	// Installment months only suggest a payment when `amount` is missing.
	if (!(planned > 0) && installmentMonths > 0) {
		const principal = initialBalance > 0 ? initialBalance : currentBalance;
		if (principal > 0) planned = principal / installmentMonths;
	}

	const monthlyMinimum = clampNumber(params.monthlyMinimum);
	const min = Number.isFinite(monthlyMinimum) ? monthlyMinimum : 0;

	// For credit/store cards the monthly minimum IS the planned payment.
	const isCardType = params.debtType === "credit_card" || params.debtType === "store_card";
	if (isCardType && min > 0) {
		planned = min;
	} else if (min > 0) {
		planned = Math.max(planned, min);
	}

	const computedMonthlyPayment = Math.max(0, planned);

	const interestRatePct = clampNumber(params.interestRatePct);
	const interestPct = Number.isFinite(interestRatePct) ? interestRatePct : 0;
	const payDateRaw = clampNumber(params.payDate);
	const payDate = Number.isFinite(payDateRaw) && payDateRaw >= 1 ? Math.trunc(payDateRaw) : 1;
	const payFrequency = normalizePayFrequency(params.payFrequency);
	const periodsPerYear = payFrequency === "weekly" ? 52 : payFrequency === "every_2_weeks" ? 26 : 12;
	const periodRate = interestPct > 0 ? interestPct / 100 / periodsPerYear : 0;
	const anchorPeriodKey = resolveProjectionAnchorPeriodKey({
		now,
		dueDate: params.dueDate,
		dueDay: params.dueDay,
		payDate,
		payFrequency,
	});

	const projection = buildProjection({
		balance: currentBalance,
		monthlyPayment: computedMonthlyPayment,
		periodRate,
		maxMonths,
		anchorPeriodKey,
		payDate,
		payFrequency,
		scheduledOverrides: params.plannedPaymentOverrides,
	});
	const points = projection.points;
	const payoffDate = projection.lastPaymentDate ?? startOfUtcDay(now);
	const monthsLeft = diffCalendarMonthsCeil(now, payoffDate);
	const cannotPayoff = points[points.length - 1] > 0;

	if (currentBalance <= 0 || points.length <= 1 || cannotPayoff) {
		return {
			computedMonthlyPayment,
			computedMonthsLeft: cannotPayoff ? null : 0,
			computedPaidOffBy: null,
		};
	}

	return {
		computedMonthlyPayment,
		computedMonthsLeft: monthsLeft,
		computedPaidOffBy: payoffDate.toISOString(),
	};
}
