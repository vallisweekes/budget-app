export type DebtPayoffProjection = {
	computedMonthlyPayment: number;
	computedMonthsLeft: number | null;
	computedPaidOffBy: string | null;
};

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

	// Fallback: if the user didn't set a planned monthly payment, use the installment plan.
	// Installment is based on the original balance so after month 1 is paid, months-left drops.
	if (!(planned > 0) && installmentMonths > 0) {
		const principal = initialBalance > 0 ? initialBalance : currentBalance;
		if (principal > 0) planned = principal / installmentMonths;
	}

	const monthlyMinimum = clampNumber(params.monthlyMinimum);
	const min = Number.isFinite(monthlyMinimum) ? monthlyMinimum : 0;
	if (min > 0) planned = Math.max(planned, min);

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

	const payoffDate = new Date(now.getTime());
	payoffDate.setMonth(payoffDate.getMonth() + monthsLeft);

	return {
		computedMonthlyPayment,
		computedMonthsLeft: monthsLeft,
		computedPaidOffBy: payoffDate.toISOString(),
	};
}
