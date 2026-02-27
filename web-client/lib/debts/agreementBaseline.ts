export type AgreementBaselineResult = {
	paymentsScheduled: number;
	paymentsMade: number;
	historicalPaidAmount: number;
	computedCurrentBalance: number;
};

function clampNumber(value: unknown): number {
	if (typeof value === "number") return value;
	if (typeof value === "string") return Number(value);
	if (value && typeof value === "object" && "toString" in value && typeof (value as any).toString === "function") {
		return Number((value as any).toString());
	}
	return Number(value as any);
}

function parseYmd(value: unknown): Date | null {
	if (typeof value !== "string") return null;
	const s = value.trim();
	if (!s) return null;

	// Accept either YYYY-MM-DD (legacy) or DD/MM/YYYY (global app format).
	const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (ymd) {
		const d = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00.000Z`);
		return Number.isFinite(d.getTime()) ? d : null;
	}

	const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
	if (!dmy) return null;
	const day = Number(dmy[1]);
	const month = Number(dmy[2]);
	const year = Number(dmy[3]);
	if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
	const monthIndex = month - 1;
	const utc = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
	if (!Number.isFinite(utc.getTime())) return null;
	// Guard against JS date rollover (e.g. 31/02/2026).
	if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== monthIndex || utc.getUTCDate() !== day) return null;
	return utc;
}

function diffScheduledPayments(params: { firstPaymentDate: Date; now: Date; dayOfMonth: number }): number {
	const first = params.firstPaymentDate;
	const now = params.now;
	const day = Math.max(1, Math.min(28, Math.trunc(params.dayOfMonth)));

	// Count months between first payment month and current month,
	// then include the first payment month (=> +1).
	const monthDiff = (now.getUTCFullYear() - first.getUTCFullYear()) * 12 + (now.getUTCMonth() - first.getUTCMonth());
	let scheduled = monthDiff + 1;
	// If we're before the payment day in the current month, that payment isn't scheduled yet.
	if (now.getUTCDate() < day) scheduled -= 1;
	return Math.max(0, scheduled);
}

export function computeAgreementBaseline(params: {
	initialBalance: unknown;
	monthlyPayment: unknown;
	annualInterestRatePct: unknown;
	installmentMonths?: unknown;
	firstPaymentDate: unknown; // YYYY-MM-DD
	now?: Date;
	missedMonths?: unknown;
	missedPaymentFee?: unknown;
}): AgreementBaselineResult | { error: string } {
	const now = params.now ?? new Date();
	const firstPaymentDate = parseYmd(params.firstPaymentDate);
	if (!firstPaymentDate) return { error: "Invalid firstPaymentDate" };

	const initialBalance = Math.max(0, clampNumber(params.initialBalance));
	const monthlyPayment = Math.max(0, clampNumber(params.monthlyPayment));
	if (!(initialBalance > 0)) return { error: "initialBalance must be > 0" };
	if (!(monthlyPayment > 0)) return { error: "monthlyPayment must be > 0" };

	const installmentMonthsRaw = clampNumber(params.installmentMonths);
	const installmentMonths = Number.isFinite(installmentMonthsRaw) ? Math.max(0, Math.trunc(installmentMonthsRaw)) : 0;

	const missedMonthsRaw = clampNumber(params.missedMonths);
	const missedMonths = Number.isFinite(missedMonthsRaw) ? Math.max(0, Math.trunc(missedMonthsRaw)) : 0;
	const missedFeeRaw = clampNumber(params.missedPaymentFee);
	const missedPaymentFee = Number.isFinite(missedFeeRaw) ? Math.max(0, missedFeeRaw) : 0;

	const paymentsScheduledUncapped = diffScheduledPayments({ firstPaymentDate, now, dayOfMonth: firstPaymentDate.getUTCDate() });
	const paymentsScheduled = installmentMonths > 0 ? Math.min(installmentMonths, paymentsScheduledUncapped) : paymentsScheduledUncapped;
	const paymentsMade = Math.max(0, paymentsScheduled - missedMonths);

	const annualRatePct = clampNumber(params.annualInterestRatePct);
	const annualRate = Number.isFinite(annualRatePct) ? Math.max(0, annualRatePct) / 100 : 0;
	const monthlyRate = annualRate > 0 ? annualRate / 12 : 0;

	// Compute remaining balance as of now.
	// We only have a count of missed months, not which months; simplest assumption:
	// missed months are the most recent ones.
	let balance = initialBalance;
	for (let monthIndex = 1; monthIndex <= paymentsScheduled; monthIndex += 1) {
		if (monthlyRate > 0) balance *= 1 + monthlyRate;
		const isMissed = monthIndex > paymentsMade;
		if (!isMissed) balance -= monthlyPayment;
		else if (missedPaymentFee > 0) balance += missedPaymentFee;
		balance = Math.max(0, balance);
		if (balance === 0) break;
	}

	const historicalPaidAmount = paymentsMade * monthlyPayment;

	return {
		paymentsScheduled,
		paymentsMade,
		historicalPaidAmount,
		computedCurrentBalance: balance,
	};
}
