/**
 * Single source of truth for expense "paid" amounts.
 *
 * All surfaces (dashboard, expense summary, income analysis) MUST use this
 * helper instead of reading `expense.paid` / `expense.paidAmount` scalar fields.
 *
 * The `ExpensePayment` transaction table is the canonical record of actual payments.
 * The scalar fields on `Expense` are a denormalized cache that can drift.
 */
import { prisma } from "@/lib/prisma";

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

export interface ExpensePaidInfo {
	/** Total paid amount from all payment records */
	paidAmount: number;
	/** Whether the expense is fully paid (paidAmount >= expense amount) */
	isPaid: boolean;
	/** Amount paid from income specifically */
	paidFromIncome: number;
}

/**
 * Given a list of expense IDs (and their planned amounts), resolve the actual
 * paid status from `expensePayment` transaction records.
 *
 * @param expenses Array of { id, amount } — we need the planned amount to
 *   determine isPaid (paidAmount >= amount).
 * @param opts.periodStart If given, only count payments within this date range.
 * @param opts.periodEnd If given, only count payments within this date range.
 * @returns Map of expenseId → ExpensePaidInfo
 */
export async function getExpensePaidMap(
	expenses: Array<{ id: string; amount: number }>,
	opts?: { periodStart?: Date; periodEnd?: Date },
): Promise<Map<string, ExpensePaidInfo>> {
	const result = new Map<string, ExpensePaidInfo>();

	if (expenses.length === 0) return result;

	// Initialize with zeros
	for (const e of expenses) {
		result.set(e.id, { paidAmount: 0, isPaid: false, paidFromIncome: 0 });
	}

	const ids = expenses.map((e) => e.id);

	// Build the where clause
	const where: Record<string, unknown> = { expenseId: { in: ids } };
	if (opts?.periodStart && opts?.periodEnd) {
		where.paidAt = { gte: opts.periodStart, lte: opts.periodEnd };
	}

	// Group payments by expenseId and source
	const paymentRows = await prisma.expensePayment.groupBy({
		by: ["expenseId", "source"],
		where: where as any,
		_sum: { amount: true },
	});

	// Build amounts map
	const amtMap = new Map(expenses.map((e) => [e.id, e.amount]));

	for (const row of paymentRows) {
		const expId = row.expenseId;
		const info = result.get(expId);
		if (!info) continue;

		const rowAmount = decimalToNumber(row._sum.amount);
		info.paidAmount += rowAmount;

		if (row.source === "income") {
			info.paidFromIncome += rowAmount;
		}
	}

	// Determine isPaid based on amount comparison
	for (const e of expenses) {
		const info = result.get(e.id);
		if (!info) continue;
		info.isPaid = e.amount > 0 && info.paidAmount >= e.amount;
	}

	return result;
}

/**
 * Quick aggregate: total paid from income across a set of expenses.
 * Used by the income analysis for the "remaining income" calc.
 */
export async function getTotalPaidFromIncome(
	expenseIds: string[],
	periodStart: Date,
	periodEnd: Date,
): Promise<number> {
	if (expenseIds.length === 0) return 0;

	const agg = await prisma.expensePayment.aggregate({
		where: {
			expenseId: { in: expenseIds },
			paidAt: { gte: periodStart, lte: periodEnd },
			source: "income",
		},
		_sum: { amount: true },
	});

	return decimalToNumber(agg._sum.amount);
}
