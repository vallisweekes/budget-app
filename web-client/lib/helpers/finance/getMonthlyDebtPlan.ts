import { prisma } from "@/lib/prisma";
import { getEarlyPaymentWindowStart } from "@/lib/helpers/finance/earlyPaymentWindow";

type Params = {
	budgetPlanId: string;
	year: number;
	month: number;
	/** When provided, paid totals are scoped by periodKey instead of year/month columns. */
	periodKey?: string;
	/** @deprecated Use periodKey. When provided and periodKey is absent, uses paidAt range. */
	periodStart?: Date;
	periodEnd?: Date;
};

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "string") return Number(value);
	if (typeof value === "object") {
		const maybeDecimal = value as { toNumber?: () => number; toString?: () => string };
		if (typeof maybeDecimal.toNumber === "function") return maybeDecimal.toNumber();
		if (typeof maybeDecimal.toString === "function") return Number(maybeDecimal.toString());
	}
	return Number(value);
}

/**
 * Single source of truth for monthly debt plan math.
 *
 * - Includes ALL active debts for the plan (not source-limited)
 * - Keeps planned debt as the full monthly obligation
 * - Tracks paid amounts separately (for "paid so far" style UI)
 * - Also returns income-sourced paid amount for UI breakdowns
 */
export async function getMonthlyDebtPlan({ budgetPlanId, year, month, periodKey, periodStart, periodEnd }: Params) {
	const computeMonthlyPlannedPayment = (d: {
		amount: unknown;
		currentBalance: unknown;
		initialBalance: unknown;
		installmentMonths: unknown;
		monthlyMinimum: unknown;
		sourceType: unknown;
		type: unknown;
	}) => {
		const currentBalance = Math.max(0, decimalToNumber(d.currentBalance));
		if (!(currentBalance > 0)) return 0;

		const rawAmount = decimalToNumber(d.amount);
		const amount = Number.isFinite(rawAmount) ? Math.max(0, rawAmount) : 0;

		const rawMonthlyMinimum = decimalToNumber(d.monthlyMinimum);
		const monthlyMinimum = Number.isFinite(rawMonthlyMinimum) ? Math.max(0, rawMonthlyMinimum) : 0;

		const installmentMonths = Number(d.installmentMonths ?? 0);
		const safeInstallmentMonths = Number.isFinite(installmentMonths) ? Math.max(0, Math.floor(installmentMonths)) : 0;

		const initialBalance = Math.max(0, decimalToNumber(d.initialBalance));
		const principal = initialBalance > 0 ? initialBalance : currentBalance;

		// `amount` is the planned monthly payment when present.
		// Installment months only provide a fallback when the payment amount isn't stored.
		let planned = 0;
		if (amount > 0) {
			planned = amount;
		} else if (safeInstallmentMonths > 0 && principal > 0) {
			planned = principal / safeInstallmentMonths;
		}

		// For credit/store cards the monthly minimum IS the planned payment.
		const isCardType = d.type === "credit_card" || d.type === "store_card";
		if (isCardType && monthlyMinimum > 0) {
			planned = monthlyMinimum;
		} else if (monthlyMinimum > 0) {
			planned = Math.max(planned, monthlyMinimum);
		}

		// Expense-derived debts: if no monthly plan is configured, treat the remaining balance as due.
		// (This preserves previous behavior for auto-transferred overdue bills.)
		if (planned <= 0 && d.sourceType === "expense") {
			planned = amount > 0 ? amount : currentBalance;
		}

		planned = Number.isFinite(planned) ? Math.max(0, planned) : 0;
		return Math.min(currentBalance, planned);
	};

	// Build payment filter: prefer periodKey > paidAt range > year/month
	const paymentFilter = (() => {
		if (periodKey) {
			// When a pay-period boundary is available, include a small lookback window
			// so early payments count toward the intended upcoming period.
			if (periodStart) {
				const earlyPaymentStart = getEarlyPaymentWindowStart(periodStart);
				return {
					debt: { budgetPlanId },
					OR: [{ periodKey }, { paidAt: { gte: earlyPaymentStart, lt: periodStart } }],
				};
			}
			return { debt: { budgetPlanId }, periodKey };
		}

		if (periodStart && periodEnd) {
			return { debt: { budgetPlanId }, paidAt: { gte: periodStart, lte: periodEnd } };
		}

		return { debt: { budgetPlanId }, year, month };
	})();

	const [dueDebts, paidAllAgg, paidIncomeAgg] = await Promise.all([
		prisma.debt.findMany({
			where: {
				budgetPlanId,
				paid: false,
				currentBalance: { gt: 0 },
			},
			select: {
				id: true,
				amount: true,
				currentBalance: true,
				initialBalance: true,
				installmentMonths: true,
				monthlyMinimum: true,
				sourceType: true,
				type: true,
			},
		}),
		prisma.debtPayment.aggregate({
			where: paymentFilter,
			_sum: { amount: true },
		}),
		prisma.debtPayment.aggregate({
			where: { ...paymentFilter, source: "income" },
			_sum: { amount: true },
		}),
	]);

	const totalDueDebts = dueDebts.reduce((sum, d) => sum + computeMonthlyPlannedPayment(d), 0);
	const totalPaidDebtPayments = decimalToNumber(paidAllAgg._sum.amount);
	const paidDebtPaymentsFromIncome = decimalToNumber(paidIncomeAgg._sum.amount);
	const plannedDebtPayments = totalDueDebts;
	const remainingDebtPayments = Math.max(0, totalDueDebts - totalPaidDebtPayments);

	return {
		totalDueDebts,
		totalPaidDebtPayments,
		paidDebtPaymentsFromIncome,
		plannedDebtPayments,
		remainingDebtPayments,
	};
}
