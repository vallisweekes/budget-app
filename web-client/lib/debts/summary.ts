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

	const regularCardDebtIds = regularDebts
		.filter((debt) => debt.type === "credit_card" || debt.type === "store_card")
		.map((debt) => debt.id);

	const [cardDebtPaymentRows, cardExpenseUsageRows] = regularCardDebtIds.length
		? await Promise.all([
				prisma.debtPayment.groupBy({
					by: ["debtId"],
					where: { debtId: { in: regularCardDebtIds } },
					_count: { _all: true },
				}),
				prisma.expense.findMany({
					where: {
						budgetPlanId,
						cardDebtId: { in: regularCardDebtIds },
						paymentSource: "credit_card",
					},
					select: { cardDebtId: true },
				}),
			])
		: [[], []];

	const cardDebtIdsWithPayments = new Set(
		cardDebtPaymentRows
			.filter((row) => Number(row._count._all ?? 0) > 0)
			.map((row) => row.debtId)
	);
	const cardDebtIdsWithExpenseUsage = new Set(
		cardExpenseUsageRows
			.map((row) => String(row.cardDebtId ?? "").trim())
			.filter(Boolean)
	);

	// Keep cards hidden from debt summaries until they are actually in use.
	const visibleRegularDebts = regularDebts.filter((debt) => {
		if (!(debt.type === "credit_card" || debt.type === "store_card")) return true;

		const hasPlannedPayment = Number(debt.amount ?? 0) > 0 || Number(debt.monthlyMinimum ?? 0) > 0;
		const hasPaidAmount = Number(debt.paidAmount ?? 0) > 0;
		const hasPaymentActivity = cardDebtIdsWithPayments.has(debt.id);
		const hasExpenseUsage = cardDebtIdsWithExpenseUsage.has(debt.id);

		return hasPlannedPayment || hasPaidAmount || hasPaymentActivity || hasExpenseUsage;
	});

	const visibleExpenseDebts = expenseDebts.filter((debt) => !isExpenseDebtCoveredByRegularDebt({
		expenseName: debt.sourceExpenseName ?? debt.name,
		sourceCategoryName: debt.sourceCategoryName,
		regularDebts: visibleRegularDebts,
	}));
	const allDebts = [...visibleRegularDebts, ...visibleExpenseDebts];

	const activeDebts = allDebts.filter((d) => (d.currentBalance ?? 0) > 0);
	const activeRegularDebts = visibleRegularDebts.filter((d) => (d.currentBalance ?? 0) > 0);
	const activeExpenseDebts = visibleExpenseDebts.filter((d) => (d.currentBalance ?? 0) > 0);

	const creditCards = visibleRegularDebts.filter((d) => d.type === "credit_card" || d.type === "store_card");
	const totalDebtBalance = allDebts.reduce((sum, debt) => sum + (debt.currentBalance || 0), 0);

	return {
		regularDebts: visibleRegularDebts,
		expenseDebts: visibleExpenseDebts,
		allDebts,
		activeDebts,
		activeRegularDebts,
		activeExpenseDebts,
		creditCards,
		totalDebtBalance,
	};
}
