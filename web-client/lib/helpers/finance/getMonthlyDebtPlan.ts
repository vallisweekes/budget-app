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
	const [dueDebts, paidAllAgg, paidIncomeAgg] = await Promise.all([
		prisma.debt.findMany({
			where: {
				budgetPlanId,
				paid: false,
				currentBalance: { gt: 0 },
			},
			select: { id: true, amount: true },
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

	const totalDueDebts = dueDebts.reduce((sum, d) => sum + decimalToNumber(d.amount), 0);
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
