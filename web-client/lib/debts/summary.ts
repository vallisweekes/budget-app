import type { DebtItem } from "@/types/helpers/debts";
import { processMissedDebtPaymentsToAccrue } from "@/lib/debts/carryover";
import { getAllDebts } from "@/lib/debts/store";
import { getExpenseDebts, processOverdueExpensesToDebts } from "@/lib/expenses/carryover";
import { isExpenseDebtCoveredByRegularDebt } from "@/lib/helpers/debts/expenseDebtDuplicates";
import { prisma } from "@/lib/prisma";

export type DebtSummary = {
	regularDebts: DebtItem[];
	expenseDebts: DebtItem[];
	allDebts: DebtItem[];
	activeDebts: DebtItem[];
	activeRegularDebts: DebtItem[];
	activeExpenseDebts: DebtItem[];
	creditCards: DebtItem[];
	totalDebtBalance: number;
};

export async function getDebtSummaryForPlan(
	budgetPlanId: string,
	opts?: {
		includeExpenseDebts?: boolean;
		ensureSynced?: boolean;
	}
): Promise<DebtSummary> {
	const includeExpenseDebts = opts?.includeExpenseDebts ?? false;
	const ensureSynced = opts?.ensureSynced ?? true;

	if (ensureSynced) {
		await Promise.all([
			// Keep the 5-day overdue carryover behavior for real non-allocation expenses.
			includeExpenseDebts ? processOverdueExpensesToDebts(budgetPlanId) : Promise.resolve([]),
			// Ensure missed debt payments (due date + grace) accumulate into balances.
			processMissedDebtPaymentsToAccrue(budgetPlanId),
		]);
	}

	const [allDebtsRaw, expenseDebts] = await Promise.all([
		getAllDebts(budgetPlanId),
		includeExpenseDebts ? getExpenseDebts(budgetPlanId) : Promise.resolve([]),
	]);

	// For regular (non-expense) debts, ensure `paidAmount` reflects recorded DebtPayment rows.
	// This keeps web SSR views consistent with payment history and mobile.
	const regularDebtsBase = allDebtsRaw.filter((d) => d.sourceType !== "expense");
	const regularDebtIds = regularDebtsBase.map((d) => d.id);
	const paidAggRows = regularDebtIds.length
		? await prisma.debtPayment.groupBy({
				by: ["debtId"],
				where: { debtId: { in: regularDebtIds } },
				_sum: { amount: true },
		  })
		: [];
	const paidAllTimeByDebtId = new Map(
		paidAggRows.map((row) => [row.debtId, Number(row._sum.amount ?? 0)])
	);
	const regularDebts: DebtItem[] = regularDebtsBase.map((d) => {
		const computedPaid = paidAllTimeByDebtId.get(d.id);
		return computedPaid == null || !Number.isFinite(computedPaid)
			? d
			: { ...d, paidAmount: computedPaid };
	});
	const visibleExpenseDebts = expenseDebts.filter((debt) => !isExpenseDebtCoveredByRegularDebt({
		expenseName: debt.sourceExpenseName ?? debt.name,
		sourceCategoryName: debt.sourceCategoryName,
		regularDebts,
	}));
	const allDebts = [...regularDebts, ...visibleExpenseDebts];

	const activeDebts = allDebts.filter((d) => (d.currentBalance ?? 0) > 0);
	const activeRegularDebts = regularDebts.filter((d) => (d.currentBalance ?? 0) > 0);
	const activeExpenseDebts = visibleExpenseDebts.filter((d) => (d.currentBalance ?? 0) > 0);

	const creditCards = regularDebts.filter((d) => d.type === "credit_card" || d.type === "store_card");
	const totalDebtBalance = allDebts.reduce((sum, debt) => sum + (debt.currentBalance || 0), 0);

	return {
		regularDebts,
		expenseDebts: visibleExpenseDebts,
		allDebts,
		activeDebts,
		activeRegularDebts,
		activeExpenseDebts,
		creditCards,
		totalDebtBalance,
	};
}
