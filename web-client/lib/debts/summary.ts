import type { DebtItem } from "@/types/helpers/debts";
import { processMissedDebtPaymentsToAccrue } from "@/lib/debts/carryover";
import { getAllDebts } from "@/lib/debts/store";
import { getExpenseDebts, processOverdueExpensesToDebts } from "@/lib/expenses/carryover";
import { syncDueDirectDebitExpenses } from "@/lib/expenses/directDebit";
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
		recomputePaidAmounts?: boolean;
	}
): Promise<DebtSummary> {
	const includeExpenseDebts = opts?.includeExpenseDebts ?? false;
	const ensureSynced = opts?.ensureSynced ?? true;
	const recomputePaidAmounts = opts?.recomputePaidAmounts ?? true;

	if (ensureSynced) {
		if (includeExpenseDebts) {
			await syncDueDirectDebitExpenses({ budgetPlanId }).catch((error) => {
				console.error("Debt summary: direct debit sync failed", error);
				return [];
			});

			await processOverdueExpensesToDebts(budgetPlanId).catch((error) => {
				console.error("Debt summary: expense carryover sync failed", error);
				return [];
			});
		}

		await Promise.all([
			processMissedDebtPaymentsToAccrue(budgetPlanId).catch((error) => {
				console.error("Debt summary: missed debt payment sync failed", error);
			})
		]);
	}

	const [allDebtsRaw, expenseDebts] = await Promise.all([
		getAllDebts(budgetPlanId),
		includeExpenseDebts ? getExpenseDebts(budgetPlanId) : Promise.resolve([]),
	]);

	const regularDebtsBase = allDebtsRaw.filter((d) => d.sourceType !== "expense");
	const regularDebts: DebtItem[] = recomputePaidAmounts
		? await (async () => {
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

			return regularDebtsBase.map((d) => {
				const computedPaid = paidAllTimeByDebtId.get(d.id);
				return computedPaid == null || !Number.isFinite(computedPaid)
					? d
					: { ...d, paidAmount: computedPaid };
			});
		})()
		: regularDebtsBase;
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
