import { prisma } from "@/lib/prisma";

type Params = {
	budgetPlanId: string;
	year: number;
	month: number;
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
export async function getMonthlyDebtPlan({ budgetPlanId, year, month }: Params) {
	const computeMonthlyPlannedPayment = (d: {
		amount: unknown;
		currentBalance: unknown;
		initialBalance: unknown;
		installmentMonths: unknown;
		monthlyMinimum: unknown;
		sourceType: unknown;
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

		// If the debt is configured as an installment plan, prefer that monthly payment.
		let planned = 0;
		if (safeInstallmentMonths > 0 && principal > 0) {
			planned = principal / safeInstallmentMonths;
		} else if (amount > 0) {
			// Otherwise, use the configured monthly amount.
			planned = amount;
		}

		// Monthly minimum can raise the planned payment.
		if (monthlyMinimum > 0) planned = Math.max(planned, monthlyMinimum);

		// Expense-derived debts: if no monthly plan is configured, treat the remaining balance as due.
		// (This preserves previous behavior for auto-transferred overdue bills.)
		if (planned <= 0 && d.sourceType === "expense") {
			planned = amount > 0 ? amount : currentBalance;
		}

		planned = Number.isFinite(planned) ? Math.max(0, planned) : 0;
		return Math.min(currentBalance, planned);
	};

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
			},
		}),
		prisma.debtPayment.aggregate({
			where: { debt: { budgetPlanId }, year, month },
			_sum: { amount: true },
		}),
		prisma.debtPayment.aggregate({
			where: { debt: { budgetPlanId }, year, month, source: "income" },
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
