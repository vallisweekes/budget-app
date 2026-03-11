import { prisma } from "@/lib/prisma";
import { getEarlyPaymentWindowStart } from "@/lib/helpers/finance/earlyPaymentWindow";
import { isNonDebtCategoryName } from "@/lib/expenses/helpers";
import { isExpenseDebtCoveredByRegularDebt } from "@/lib/helpers/debts/expenseDebtDuplicates";

type MoneyLike = number | string | null | undefined | { toString?: () => string };

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

type DueDebtRow = {
	id: string;
	name: string | null;
	amount: unknown;
	currentBalance: MoneyLike;
	initialBalance: unknown;
	installmentMonths: unknown;
	monthlyMinimum: unknown;
	sourceType: string | null;
	type: string | null;
	paid: boolean;
	sourceExpenseName: string | null;
	sourceCategoryName: string | null;
	dueDate: Date | null;
	dueDay: number | null;
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

function clampDay(year: number, monthIndex0: number, day: number): number {
	const maxDay = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
	return Math.max(1, Math.min(maxDay, Math.floor(day)));
}

function resolveDebtDueDateUtc(params: {
	debt: Pick<DueDebtRow, "dueDate" | "dueDay">;
	year: number;
	month: number;
}): Date | null {
	if (params.debt.dueDate instanceof Date && Number.isFinite(params.debt.dueDate.getTime())) {
		return new Date(Date.UTC(
			params.debt.dueDate.getUTCFullYear(),
			params.debt.dueDate.getUTCMonth(),
			params.debt.dueDate.getUTCDate(),
		));
	}

	const dueDay = Number(params.debt.dueDay ?? 0);
	if (!Number.isFinite(dueDay) || dueDay < 1) return null;

	const monthIndex0 = params.month - 1;
	return new Date(Date.UTC(params.year, monthIndex0, clampDay(params.year, monthIndex0, dueDay)));
}

function isDateWithinInclusiveRange(target: Date, start: Date, end: Date): boolean {
	const time = target.getTime();
	return time >= start.getTime() && time <= end.getTime();
}

function shouldIncludeDebtInPlannedPeriod(params: {
	debt: DueDebtRow;
	regularDebts: DueDebtRow[];
	year: number;
	month: number;
	periodStart?: Date;
	periodEnd?: Date;
}): boolean {
	const { debt, regularDebts, year, month, periodStart, periodEnd } = params;

	if (debt.sourceType === "expense") {
		if (isNonDebtCategoryName(debt.sourceCategoryName)) return false;
		if (isExpenseDebtCoveredByRegularDebt({
			expenseName: debt.sourceExpenseName,
			sourceCategoryName: debt.sourceCategoryName,
			regularDebts,
		})) {
			return false;
		}

		// Expense-derived debts should only count when their due date falls in the
		// selected reporting window; otherwise future migrated debts inflate
		// the current month's planned debt total.
		const dueDateUtc = resolveDebtDueDateUtc({ debt, year, month });
		if (!(dueDateUtc instanceof Date)) return false;

		if (periodStart instanceof Date && periodEnd instanceof Date) {
			if (!isDateWithinInclusiveRange(dueDateUtc, periodStart, periodEnd)) return false;
		} else {
			if (
				dueDateUtc.getUTCFullYear() !== year ||
				dueDateUtc.getUTCMonth() + 1 !== month
			) {
				return false;
			}
		}
	}

	return true;
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
				name: true,
				amount: true,
				currentBalance: true,
				initialBalance: true,
				installmentMonths: true,
				monthlyMinimum: true,
				sourceType: true,
				sourceExpenseName: true,
				sourceCategoryName: true,
				dueDate: true,
				dueDay: true,
				paid: true,
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

	const regularDebts = dueDebts.filter((debt) => debt.sourceType !== "expense");
	const visibleDueDebts = dueDebts.filter((debt) => shouldIncludeDebtInPlannedPeriod({
		debt,
		regularDebts,
		year,
		month,
		periodStart,
		periodEnd,
	}));

	const totalDueDebts = visibleDueDebts.reduce((sum, d) => sum + computeMonthlyPlannedPayment(d), 0);
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
