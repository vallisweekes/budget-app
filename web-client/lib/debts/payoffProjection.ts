export type DebtPayoffProjection = {
	computedMonthlyPayment: number;
	computedMonthsLeft: number | null;
	computedPaidOffBy: string | null;
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

function resolveProjectionAnchorDate(params: { now: Date; dueDate: unknown; dueDay: unknown }): Date {
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

function buildProjection(balance: number, monthlyPayment: number, monthlyRate: number, maxMonths: number): number[] {
	const points: number[] = [balance];
	let current = balance;
	for (let index = 0; index < maxMonths; index += 1) {
		if (current <= 0) break;
		current = monthlyRate > 0 ? current * (1 + monthlyRate) - monthlyPayment : current - monthlyPayment;
		current = Math.max(0, current);
		points.push(current);
		if (current === 0) break;
	}
	return points;
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
	/** When provided, credit_card / store_card uses monthlyMinimum as the planned payment */
	debtType?: string;
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
	const monthlyRate = interestPct > 0 ? interestPct / 100 / 12 : 0;

	const points = buildProjection(currentBalance, computedMonthlyPayment, monthlyRate, maxMonths);
	const monthsLeft = points.length - 1;
	const cannotPayoff = computedMonthlyPayment === 0 || points[points.length - 1] > 0;

	if (currentBalance <= 0 || monthsLeft <= 0 || cannotPayoff) {
		return {
			computedMonthlyPayment,
			computedMonthsLeft: cannotPayoff ? null : 0,
			computedPaidOffBy: null,
		};
	}

	const anchorDate = resolveProjectionAnchorDate({ now, dueDate: params.dueDate, dueDay: params.dueDay });
	const payoffDate = new Date(anchorDate.getTime());
	payoffDate.setMonth(payoffDate.getMonth() + Math.max(0, monthsLeft - 1));

	return {
		computedMonthlyPayment,
		computedMonthsLeft: monthsLeft,
		computedPaidOffBy: payoffDate.toISOString(),
	};
}
